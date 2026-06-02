// Bob — client-side logic. No external deps.
(function () {
  var FORMSPREE = 'https://formspree.io/f/manrbvok';

  // ---------- Mobile menu ----------
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.mobile-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', menu.classList.contains('open') ? 'true' : 'false');
    });
  }

  // ---------- Formspree submission for HTML forms ----------
  document.querySelectorAll('form[data-bob-form]').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var ok = form.querySelector('.form-success');
      var err = form.querySelector('.form-error');
      if (ok) ok.classList.remove('show');
      if (err) err.classList.remove('show');
      if (btn) { btn.disabled = true; btn.dataset.oldLabel = btn.textContent; btn.textContent = 'Invio...'; }
      try {
        var res = await fetch(form.action, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(form),
        });
        if (res.ok) {
          if (ok) ok.classList.add('show');
          form.reset();
        } else {
          if (err) err.classList.add('show');
        }
      } catch (_) {
        if (err) err.classList.add('show');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.oldLabel || 'Invia'; }
      }
    });
  });

  // ---------- Bob chat ----------
  var chat = document.querySelector('[data-bob-chat]');
  if (chat) initChat(chat);

  function initChat(root) {
    var feed = root.querySelector('.chat-feed');
    var optionsEl = root.querySelector('.chat-options');
    var inputRow = root.querySelector('.chat-input-row');
    var resultEl = root.querySelector('.chat-result');
    var base = root.getAttribute('data-base') || '';

    var services = [
      { slug: 'idraulico',         label: 'Idraulico',          kw: ['idraulic','tubo','perdita','rubinetto','scarico','caldaia','wc','bagno allag','infiltrazion','boiler'] },
      { slug: 'elettricista',      label: 'Elettricista',       kw: ['elettric','corrente','salta luce','impianto elettric','presa','interruttore','contatore','quadro'] },
      { slug: 'pulizie',           label: 'Imprese di pulizie', kw: ['puliz','pulire','sanific','colf','domestic','dopo trasloc','vetri','condomin'] },
      { slug: 'imbianchino',       label: 'Imbianchino',        kw: ['imbianch','tinteggi','pittur','vernici','muri','pareti'] },
      { slug: 'traslochi',         label: 'Traslochi',          kw: ['trasloc','spostare mobil','imballagg','furgone','trasport mobil'] },
      { slug: 'tuttofare',         label: 'Tuttofare',          kw: ['tuttofare','handyman','mont','ikea','fissaggio','quadri','mensol','riparazion casa'] },
      { slug: 'personal-trainer',  label: 'Personal trainer',   kw: ['personal trainer','allenament','fitness','palestra','dimagri','tonificare'] },
      { slug: 'dj-per-eventi',     label: 'DJ per eventi',      kw: ['dj','disc jockey','musica matrimon','musica festa','animazione musical'] },
      { slug: 'fotografi',         label: 'Fotografi',          kw: ['fotograf','foto matrimon','servizio fotografic','shooting','ritratto'] },
      { slug: 'ripetizioni',       label: 'Ripetizioni',        kw: ['ripetizion','tutor','lezione privat','matematic','fisic','ingles','tedesc','spagn','aiuto compit','prepar esam'] },
      { slug: 'supporto-excel',    label: 'Supporto Excel',     kw: ['excel','foglio di calcol','google sheet','formul','dashboard','vba','pivot','tabella pivot','power query'] },
    ];
    var cities = [
      { slug: 'milano', label: 'Milano' },
      { slug: 'roma',   label: 'Roma' },
      { slug: 'torino', label: 'Torino' },
    ];

    var role = null;          // 'cliente' | 'pro'
    var state = {};           // dynamic per-flow state

    // ---------- UI helpers ----------
    function botSay(text, delay) {
      delay = delay == null ? 600 : delay;
      var typing = document.createElement('div');
      typing.className = 'chat-msg bot';
      typing.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
      feed.appendChild(typing);
      feed.scrollTop = feed.scrollHeight;
      return new Promise(function (resolve) {
        setTimeout(function () {
          typing.innerHTML = text;
          feed.scrollTop = feed.scrollHeight;
          resolve();
        }, delay);
      });
    }
    function userSay(text) {
      var m = document.createElement('div');
      m.className = 'chat-msg user';
      m.textContent = text;
      feed.appendChild(m);
      feed.scrollTop = feed.scrollHeight;
    }
    function setOptions(opts, onPick) {
      optionsEl.innerHTML = '';
      inputRow.style.display = 'none';
      optionsEl.style.display = 'flex';
      opts.forEach(function (o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = o.label;
        b.addEventListener('click', function () { onPick(o); });
        optionsEl.appendChild(b);
      });
    }
    function setInput(placeholder, onSend, type) {
      optionsEl.innerHTML = '';
      optionsEl.style.display = 'none';
      inputRow.style.display = 'flex';
      var input = inputRow.querySelector('input');
      var btn = inputRow.querySelector('button');
      input.value = '';
      input.placeholder = placeholder;
      input.type = type || 'text';
      input.focus();
      function go() {
        var v = input.value.trim();
        if (!v) return;
        userSay(input.type === 'email' ? v : v);
        onSend(v);
      }
      btn.onclick = go;
      input.onkeydown = function (e) { if (e.key === 'Enter') go(); };
    }
    function hideInputs() {
      optionsEl.style.display = 'none';
      inputRow.style.display = 'none';
    }
    function matchService(text) {
      var t = text.toLowerCase();
      for (var i = 0; i < services.length; i++) {
        for (var j = 0; j < services[i].kw.length; j++) {
          if (t.indexOf(services[i].kw[j]) !== -1) return services[i];
        }
      }
      return null;
    }
    function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    // ---------- Entry point ----------
    async function start() {
      await botSay("Ciao, sono <strong>Bob</strong>. Piacere. Dimmi, ti aiuto a trovare un servizio o vuoi offrirne uno?", 300);
      setOptions(
        [
          { label: 'Cerco un servizio', value: 'cliente' },
          { label: 'Sono un professionista', value: 'pro' },
        ],
        async function (o) {
          role = o.value;
          userSay(o.label);
          if (role === 'cliente') clienteStep1();
          else proStep1();
        }
      );
    }

    // ============================================================
    // FLUSSO CLIENTE
    // ============================================================
    async function clienteStep1() {
      await botSay("Bene. Raccontami cosa ti serve, anche solo a parole tue.");
      setInput('Es. "mi serve un idraulico per una perdita"', async function (text) {
        state.freeText = text;
        var match = matchService(text);
        if (match) {
          state.service = match;
          await botSay("Perfetto, ti serve un <strong>" + match.label + "</strong>. In che città?");
          clienteStep2();
        } else {
          await botSay("Ok, scegli la categoria più vicina a quello che cerchi:");
          setOptions(services.map(function (s) { return { label: s.label, value: s }; }), async function (o) {
            state.service = o.value;
            userSay(o.label);
            await botSay("Ottimo. In che città?");
            clienteStep2();
          });
        }
      });
    }
    async function clienteStep2() {
      setOptions(cities.concat([{ slug: 'altro', label: 'Altra città' }]), async function (o) {
        state.city = o;
        userSay(o.label);
        if (o.slug === 'altro') {
          await botSay("Per ora sono attivo a Milano, Roma e Torino. Posso comunque inoltrare la tua richiesta: i professionisti nelle nuove città vengono aggiunti rapidamente.");
        }
        await botSay("Quando ti servirebbe?");
        clienteStep3();
      });
    }
    async function clienteStep3() {
      setOptions(
        [
          { label: 'Subito / urgente', value: 'urgente' },
          { label: 'Questa settimana', value: 'settimana' },
          { label: 'Questo mese', value: 'mese' },
          { label: 'Sto solo esplorando', value: 'esplora' },
        ],
        async function (o) {
          state.when = o.value;
          state.whenLabel = o.label;
          userSay(o.label);
          clienteStep4();
        }
      );
    }
    async function clienteStep4() {
      await botSay("Un'ultima cosa: <strong>che budget hai in mente?</strong> Indicarlo aiuta i professionisti a darti una proposta seria e a evitare perdite di tempo da entrambe le parti. Non è vincolante.");
      setOptions(
        [
          { label: 'Sotto 100€', value: '<100€' },
          { label: '100–500€', value: '100-500€' },
          { label: '500–2000€', value: '500-2000€' },
          { label: 'Oltre 2000€', value: '2000€+' },
          { label: 'Non lo so ancora', value: 'non so' },
        ],
        async function (o) {
          state.budget = o.value;
          state.budgetLabel = o.label;
          userSay(o.label);
          await botSay("Tutto chiaro. Ti porto al posto giusto.");
          clienteShowResult();
        }
      );
    }
    function clienteShowResult() {
      hideInputs();
      var s = state.service, c = state.city;
      var serviceUrl = base + 'servizi/' + s.slug + '.html#richiesta';
      var cityUrl = (c && c.slug !== 'altro') ? base + 'citta/' + c.slug + '.html' : null;
      var title = s.label + (c && c.slug !== 'altro' ? ' a ' + c.label : '');
      var html = '<h3>' + title + '</h3>' +
        '<p class="muted mb-0">Da qui puoi richiedere un preventivo gratuito. Ho già compilato per te quello che mi hai detto.</p>' +
        '<div class="cta-row">' +
        '<a class="btn btn-primary" href="' + serviceUrl + '">Richiedi preventivo</a>' +
        (cityUrl ? '<a class="btn btn-secondary" href="' + cityUrl + '">Vedi professionisti a ' + c.label + '</a>' : '') +
        '</div>';
      resultEl.innerHTML = html;
      resultEl.style.display = 'block';
      try {
        sessionStorage.setItem('bob_lead', JSON.stringify({
          service: s.label, slug: s.slug,
          city: c ? c.label : '',
          when: state.when, whenLabel: state.whenLabel,
          budget: state.budget, budgetLabel: state.budgetLabel,
          message: state.freeText
        }));
      } catch (_) {}
    }

    // ============================================================
    // FLUSSO PROFESSIONISTA
    // ============================================================
    async function proStep1() {
      await botSay("Fantastico, ho sempre bisogno di nuovi professionisti. Che servizio offri?");
      setOptions(services.map(function (s) { return { label: s.label, value: s }; }).concat([{ label: 'Altro', value: { slug: 'altro', label: 'Altro' } }]), async function (o) {
        state.service = o.value;
        userSay(o.label);
        if (o.value.slug === 'altro') {
          await botSay("Ok, in che ambito lavori? Scrivimelo in due parole.");
          setInput('Es. "giardiniere", "fabbro"...', async function (t) {
            state.service = { slug: 'altro', label: t };
            await botSay("Annotato: <strong>" + t + "</strong>. In quale città lavori principalmente?");
            proStep2();
          });
        } else {
          await botSay("Perfetto. In quale città lavori principalmente?");
          proStep2();
        }
      });
    }
    async function proStep2() {
      setOptions(cities.concat([{ slug: 'altro', label: 'Altra città' }]), async function (o) {
        userSay(o.label);
        if (o.slug === 'altro') {
          await botSay("Ok, scrivimi la città.");
          setInput('Es. "Bologna"', async function (t) {
            state.city = { slug: 'altro', label: t };
            proStep3();
          });
        } else {
          state.city = o;
          proStep3();
        }
      });
    }
    async function proStep3() {
      await botSay("Da quanto fai questo lavoro?");
      setOptions(
        [
          { label: 'Meno di 1 anno', value: '<1 anno' },
          { label: '1–3 anni', value: '1-3 anni' },
          { label: '3–10 anni', value: '3-10 anni' },
          { label: 'Più di 10 anni', value: '10+ anni' },
        ],
        async function (o) {
          state.experience = o.value;
          userSay(o.label);
          await botSay("Quanti clienti riesci a gestire ogni mese? Anche una stima va bene.");
          setOptions(
            [
              { label: '1–5', value: '1-5' },
              { label: '6–15', value: '6-15' },
              { label: '16–30', value: '16-30' },
              { label: 'Più di 30', value: '30+' },
            ],
            async function (o2) {
              state.capacity = o2.value;
              userSay(o2.label);
              await botSay("Su BOB la <strong>trasparenza dei prezzi</strong> è il valore principale: i clienti vedono subito chi dichiara la propria tariffa. Qual è la tua <strong>tariffa oraria indicativa</strong> in €/h? (solo manodopera, eventuali materiali a parte)");
              setInput('Es. 35', async function (rate) {
                state.hourlyRate = rate;
                await botSay("Perfetto, segnato: <strong>" + rate + " €/h</strong>. Lasciami la tua email: ti ricontatto io per attivare il profilo.");
                setInput('La tua email', async function emailHandler(v) {
                  if (!isEmail(v)) {
                    await botSay("Mmm, questa email non sembra valida. Riprova?");
                    setInput('La tua email', emailHandler, 'email');
                    return;
                  }
                  state.email = v;
                  await botSay("Ultimo passaggio: lasciami il tuo nome (e cognome se vuoi).");
                  setInput('Il tuo nome', async function (n) {
                    state.name = n;
                    await proSubmit();
                  });
                }, 'email');
              }, 'number');
            }
          );
        }
      );
    }

    async function proSubmit() {
      hideInputs();
      await botSay("Un attimo, ti salvo nei miei contatti...");
      try {
        var fd = new FormData();
        fd.append('_subject', 'Iscrizione professionista da chat — BOB');
        fd.append('_origine', 'bob.meetonda.com/chat');
        fd.append('tipo', 'professionista');
        fd.append('nome', state.name || '');
        fd.append('email', state.email || '');
        fd.append('servizio', state.service ? state.service.label : '');
        fd.append('citta', state.city ? state.city.label : '');
        fd.append('esperienza', state.experience || '');
        fd.append('capacita_mensile', state.capacity || '');
        fd.append('tariffa_oraria_eur', state.hourlyRate || '');
        var res = await fetch(FORMSPREE, {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: fd
        });
        if (!res.ok) throw new Error('formspree-fail');
        await botSay("Fatto, <strong>" + (state.name || 'benvenuto') + "</strong>. Ti ho registrato per <strong>" + state.service.label + "</strong> a <strong>" + state.city.label + "</strong>. Ti ricontatto entro 24h lavorative.");
        await botSay("Se vuoi accelerare le cose, completa il profilo con qualche dettaglio in più — tariffe, foto, esempi di lavori. Più informazioni mi dai, prima ti faccio arrivare i clienti giusti.");
        proShowResult();
      } catch (e) {
        await botSay("Non sono riuscito a salvarti — la connessione fa i capricci. Puoi riprovare oppure usare direttamente il form: <a href=\"" + base + "professionisti.html#iscrizione\">iscriviti come pro</a>.");
      }
    }

    function proShowResult() {
      var html = '<h3>Profilo registrato</h3>' +
        '<p class="muted mb-0">Ti ho inviato anche una mail dal sistema (occhio allo spam). Vuoi già completare il profilo con tariffe e dettagli?</p>' +
        '<div class="cta-row">' +
        '<a class="btn btn-primary" href="' + base + 'professionisti.html#iscrizione">Completa il profilo</a>' +
        '<a class="btn btn-secondary" href="' + base + 'come-funziona.html">Come funziona</a>' +
        '</div>';
      resultEl.innerHTML = html;
      resultEl.style.display = 'block';
      // Prefill form on professionisti page with what we already know
      try {
        sessionStorage.setItem('bob_pro_lead', JSON.stringify({
          name: state.name, email: state.email,
          service: state.service ? state.service.label : '',
          city: state.city ? state.city.label : '',
          experience: state.experience, capacity: state.capacity,
          hourlyRate: state.hourlyRate
        }));
      } catch (_) {}
    }

    start();
  }

  // ---------- Prefill cliente lead form ----------
  try {
    var lead = sessionStorage.getItem('bob_lead');
    if (lead) {
      var data = JSON.parse(lead);
      var serviceField = document.querySelector('form[data-bob-form][data-role="cliente"] [name="servizio"]') || document.querySelector('form[data-bob-form] [name="servizio"]');
      var cityField = document.querySelector('form[data-bob-form][data-role="cliente"] [name="citta"]') || document.querySelector('form[data-bob-form] [name="citta"]');
      var msgField = document.querySelector('form[data-bob-form][data-role="cliente"] [name="messaggio"]') || document.querySelector('form[data-bob-form] [name="messaggio"]');
      var whenField = document.querySelector('form[data-bob-form][data-role="cliente"] [name="quando"]') || document.querySelector('form[data-bob-form] [name="quando"]');
      var budgetField = document.querySelector('form[data-bob-form][data-role="cliente"] [name="budget"]') || document.querySelector('form[data-bob-form] [name="budget"]');
      if (serviceField && data.service && !serviceField.value) serviceField.value = data.service;
      if (cityField && data.city && !cityField.value) cityField.value = data.city;
      if (msgField && data.message && !msgField.value) msgField.value = data.message;
      if (whenField && data.when && !whenField.value) whenField.value = data.when;
      if (budgetField && data.budget && !budgetField.value) budgetField.value = data.budget;
    }
  } catch (_) {}

  // ---------- Prefill pro lead form on /professionisti.html ----------
  try {
    var proLead = sessionStorage.getItem('bob_pro_lead');
    if (proLead) {
      var pd = JSON.parse(proLead);
      var f = document.querySelector('form[data-bob-form][data-role="professionista"]') || document.querySelector('form[data-bob-form]');
      if (f) {
        var nameF = f.querySelector('[name="nome"]');
        var emailF = f.querySelector('[name="email"]');
        var svcF = f.querySelector('[name="servizio"]');
        var cityF = f.querySelector('[name="citta"]');
        var rateF = f.querySelector('[name="tariffa_oraria_eur"]');
        if (nameF && pd.name && !nameF.value) nameF.value = pd.name;
        if (emailF && pd.email && !emailF.value) emailF.value = pd.email;
        if (svcF && pd.service && !svcF.value) svcF.value = pd.service;
        if (cityF && pd.city && !cityF.value) cityF.value = pd.city;
        if (rateF && pd.hourlyRate && !rateF.value) rateF.value = pd.hourlyRate;
      }
    }
  } catch (_) {}
})();
