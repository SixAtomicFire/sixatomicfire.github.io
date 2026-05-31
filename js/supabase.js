/* ══════════════════════════════════════
   SIXsPlugins — supabase.js
   Client Supabase + tutte le chiamate API
   ══════════════════════════════════════ */

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://saxjonedufylptszbaaw.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheGpvbmVkdWZ5bHB0c3piYWF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzAwOTEsImV4cCI6MjA5NTc0NjA5MX0.7uDl6QjOQO6gKGw21X4JLHQzOPBE-Dr6MJjC7evdPyA';

// ── Supabase client (UMD via CDN, caricato prima di questo file) ──────────
const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
const SupaAuth = (() => {

  async function signUp(username, email, password) {
    const { data, error } = await _sb.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await _sb.auth.signOut();
    if (error) throw error;
  }

  async function getSession() {
    const { data: { session } } = await _sb.auth.getSession();
    return session;
  }

  async function getUser() {
    const { data: { user } } = await _sb.auth.getUser();
    return user;
  }

  // Ascolta i cambi di stato auth (login/logout)
  function onAuthChange(callback) {
    return _sb.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  // Recupera il profilo (username) dell'utente loggato
  async function getProfile(userId) {
    const { data, error } = await _sb
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  }

  return { signUp, signIn, signOut, getSession, getUser, onAuthChange, getProfile };
})();

/* ══════════════════════════════════════
   TICKETS
══════════════════════════════════════ */
const SupaTickets = (() => {

  // Crea un nuovo ticket
  async function create({ userId, username, plugin, mcVersion, title, description, priority }) {
    const { data, error } = await _sb
      .from('tickets')
      .insert({
        user_id:     userId || null,
        username,
        plugin,
        mc_version:  mcVersion,
        title,
        description,
        priority,
        status:      'open',
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Ticket dell'utente loggato
  async function getMyTickets() {
    const { data, error } = await _sb
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Singolo ticket (con messaggi)
  async function getById(id) {
    const { data, error } = await _sb
      .from('tickets')
      .select('*, ticket_messages(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }

  // Tutti i ticket (solo admin — usa service role o view)
  async function getAll(filters = {}) {
    let query = _sb
      .from('tickets')
      .select('*, ticket_messages(count)')
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'all')
      query = query.eq('status', filters.status);
    if (filters.plugin)
      query = query.eq('plugin', filters.plugin);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Aggiorna stato ticket (solo admin)
  async function updateStatus(id, status) {
    const { data, error } = await _sb
      .from('tickets')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Conta ticket per stato
  async function getCounts() {
    const { data, error } = await _sb
      .from('tickets')
      .select('status');
    if (error) return { open: 0, wip: 0, closed: 0 };
    return {
      open:   data.filter(t => t.status === 'open').length,
      wip:    data.filter(t => t.status === 'wip').length,
      closed: data.filter(t => t.status === 'closed').length,
    };
  }

  return { create, getMyTickets, getById, getAll, updateStatus, getCounts };
})();

/* ══════════════════════════════════════
   TICKET MESSAGES
══════════════════════════════════════ */
const SupaMessages = (() => {

  async function send(ticketId, { sender, senderName, body }) {
    const { data, error } = await _sb
      .from('ticket_messages')
      .insert({ ticket_id: ticketId, sender, sender_name: senderName, body })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getForTicket(ticketId) {
    const { data, error } = await _sb
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Realtime: ascolta nuovi messaggi su un ticket
  function subscribe(ticketId, callback) {
    return _sb
      .channel(`ticket-${ticketId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'ticket_messages',
        filter: `ticket_id=eq.${ticketId}`,
      }, payload => callback(payload.new))
      .subscribe();
  }

  function unsubscribe(channel) {
    _sb.removeChannel(channel);
  }

  return { send, getForTicket, subscribe, unsubscribe };
})();

/* ══════════════════════════════════════
   STORAGE (allegati ticket)
══════════════════════════════════════ */
const SupaStorage = (() => {
  const BUCKET = 'ticket-attachments';

  async function upload(ticketId, file) {
    const ext  = file.name.split('.').pop();
    const path = `${ticketId}/${Date.now()}-${file.name}`;
    const { data, error } = await _sb.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (error) throw error;

    const { data: urlData } = _sb.storage.from(BUCKET).getPublicUrl(path);

    // Salva riferimento nel DB
    await _sb.from('ticket_attachments').insert({
      ticket_id:  ticketId,
      filename:   file.name,
      size_bytes: file.size,
      url:        urlData.publicUrl,
    });

    return urlData.publicUrl;
  }

  return { upload };
})();

/* ══════════════════════════════════════
   REALTIME ADMIN (tutti i ticket live)
══════════════════════════════════════ */
const SupaRealtime = (() => {
  let _ticketChannel = null;

  function subscribeTickets(onInsert, onUpdate) {
    _ticketChannel = _sb
      .channel('admin-tickets')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'tickets'
      }, payload => onInsert && onInsert(payload.new))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'tickets'
      }, payload => onUpdate && onUpdate(payload.new))
      .subscribe();
    return _ticketChannel;
  }

  function unsubscribe() {
    if (_ticketChannel) _sb.removeChannel(_ticketChannel);
  }

  return { subscribeTickets, unsubscribe };
})();
