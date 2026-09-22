(() => {
  "use strict";

  const STORAGE_KEY = "risponditore.externalContacts.v2";
  const LEGACY_STORAGE_KEY = "risponditore.externalContacts.v1";
  const SEARCH_STOP_WORDS = new Set([
    "a", "ad", "al", "alla", "alle", "allo", "ai", "agli", "da", "dal", "dalla", "dalle", "dallo",
    "di", "del", "della", "delle", "dello", "dei", "degli", "e", "ed", "il", "lo", "la", "i", "gli",
    "le", "in", "nel", "nella", "nelle", "nello", "nei", "negli", "con", "per", "su", "sul", "sulla", "sulle",
    "sullo", "sui", "sugli", "un", "uno", "una",
    "o", "oppure", "che", "chi", "come", "cosa", "dove", "quando", "quanto", "quale", "quali", "perche",
    "posso", "potrei", "devo", "deve", "vorrei", "voglio", "fare", "faccio", "serve", "servono", "ottenere",
    "ottengo", "mi", "mio", "mia", "miei", "mie", "ho", "hai", "ha", "hanno", "sono", "si", "non", "troppi",
    "troppe", "questo", "questa", "quello", "quella"
  ]);
  const SEARCH_EQUIVALENT_GROUPS = [
    ["reclamo", "reclami", "segnalazione", "segnalazioni", "lamentela", "lamentele", "disservizio", "disservizi"],
    ["rimborso", "rimborsi", "rimborsare", "restituzione", "restituzioni", "restituire", "storno"],
    ["biglietto", "biglietti", "ticket", "titolo", "titoli"],
    ["abbonamento", "abbonamenti", "pass"],
    ["tessera", "tessere", "card", "mycard"],
    ["orario", "orari", "partenza", "partenze"],
    ["fermata", "fermate", "capolinea", "stazione"],
    ["corsa", "corse", "bus", "autobus", "pullman", "mezzo", "mezzi"],
    ["azienda", "aziende", "vettore", "vettori", "operatore", "operatori", "compagnia", "compagnie"],
    ["telefono", "telefonico", "telefonica", "chiamare", "contatto", "contatti"],
    ["email", "mail", "posta"],
    ["smarrito", "smarrita", "smarriti", "smarrite", "perso", "persa", "persi", "perse", "dimenticato", "dimenticata", "dimenticati", "dimenticate"],
    ["bagaglio", "bagagli", "valigia", "valigie", "borsa", "borse", "zaino", "zaini"],
    ["animale", "animali", "cane", "cani", "gatto", "gatti"],
    ["bambino", "bambina", "bambini", "bambine", "minore", "minori", "neonato", "neonati", "figlio", "figli"],
    ["disabile", "disabili", "disabilita", "invalidita", "invalido", "invalidi", "handicap", "104"],
    ["studente", "studentessa", "studenti", "studentesse", "universitario", "universitari"],
    ["aeroporto", "aeroporti", "aeroportuale", "aeroportuali", "volo", "voli", "aereo"],
    ["sciopero", "scioperi", "agitazione", "agitazioni", "protesta"],
    ["app", "applicazione", "applicazioni", "smartphone", "cellulare"],
    ["cancellazione", "cancellazioni", "cancellato", "cancellata", "annullamento", "annullamenti", "annullato", "annullata", "soppresso", "soppressa"],
    ["ritardo", "ritardi", "ritardato", "ritardata"],
    ["gratis", "gratuito", "gratuita", "gratuiti", "gratuite", "esenzione"],
    ["acquistare", "acquisto", "comprare", "compra", "vendita"],
    ["prenotazione", "prenotazioni", "prenotare", "riserva", "riservare"],
    ["pagamento", "pagamenti", "pagare", "transazione", "transazioni"],
    ["duplicato", "duplicati", "rifare", "sostituzione"],
    ["convalida", "convalidare", "obliterare", "obliterazione"],
    ["visualizzare", "vedere", "mostrare", "compare", "apparire"],
    ["bloccato", "bloccata", "bloccati", "bloccate", "blocca", "blocco", "crash"],
    ["home", "iniziale"]
  ];
  const SEARCH_EQUIVALENTS = new Map();
  SEARCH_EQUIVALENT_GROUPS.forEach((group) => {
    group.forEach((term) => SEARCH_EQUIVALENTS.set(term, group));
  });
  const responseCategoryIds = [...new Set([
    ...Object.keys(CAT_META),
    ...responses.cotrap.map((response) => response.category)
  ])].filter((category) => responses.cotrap.some((response) => response.category === category));

  const RESPONSE_FILTERS = [
    { id: "all", label: "Tutte", categories: null },
    ...responseCategoryIds.map((category) => ({
      id: category,
      label: CAT_META[category]?.label || category,
      categories: [category]
    }))
  ];

  const state = {
    view: "responses",
    responseFilter: "all",
    responseIndices: [],
    selectedResponseIndex: null,
    responseEditing: false,
    responseDraft: "",
    contactFilter: "all",
    contactIds: [],
    selectedContactId: null,
    contacts: loadContacts()
  };

  const elements = {
    navButtons: [...document.querySelectorAll("[data-view-target]")],
    views: [...document.querySelectorAll(".app-view")],
    responseSearch: document.getElementById("response-search"),
    responseFilters: document.getElementById("response-filters"),
    responseList: document.getElementById("response-list"),
    responseCount: document.getElementById("response-count"),
    responseQuestion: document.getElementById("response-question"),
    responsePreview: document.getElementById("response-preview"),
    responseEditor: document.getElementById("response-editor"),
    responseAlert: document.getElementById("response-review-alert"),
    responseAlertText: document.getElementById("response-review-text"),
    copyResponse: document.getElementById("copy-response"),
    editResponse: document.getElementById("edit-response"),
    responsePrev: document.getElementById("response-prev"),
    responseNext: document.getElementById("response-next"),
    contactSearch: document.getElementById("contact-search"),
    contactFilters: document.getElementById("contact-filters"),
    contactList: document.getElementById("contact-list"),
    contactCount: document.getElementById("contact-count"),
    contactTitle: document.getElementById("contact-title"),
    contactMessage: document.getElementById("contact-message"),
    contactMeta: document.getElementById("contact-meta"),
    copyContact: document.getElementById("copy-contact"),
    copyPhone: document.getElementById("copy-phone"),
    editContact: document.getElementById("edit-contact"),
    addContact: document.getElementById("add-contact"),
    importInternalContacts: document.getElementById("import-internal-contacts"),
    internalContactsFile: document.getElementById("internal-contacts-file"),
    editor: document.getElementById("contact-editor"),
    editorForm: document.getElementById("contact-editor-form"),
    editorTitle: document.getElementById("contact-editor-title"),
    editorDelete: document.getElementById("delete-contact"),
    editorCancel: document.getElementById("cancel-contact-editor"),
    editorClose: document.getElementById("close-contact-editor"),
    toast: document.getElementById("toast")
  };

  const URL_RE = /(https?:\/\/[^\s<]+)/g;
  let toastTimer = null;
  let editorReturnFocus = null;
  let deleteArmed = false;
  let deleteArmTimer = null;

  init();

  function init() {
    renderResponseFilters();
    renderContactFilters();
    bindEvents();
    filterResponses();
    filterContacts();
    switchView("responses", false);
  }

  function bindEvents() {
    elements.navButtons.forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewTarget));
    });

    elements.responseSearch.addEventListener("input", filterResponses);
    elements.contactSearch.addEventListener("input", filterContacts);
    elements.responseEditor.addEventListener("input", () => {
      state.responseDraft = elements.responseEditor.value;
      updateResponseCopyState();
    });

    elements.responsePrev.addEventListener("click", () => moveResponseSelection(-1));
    elements.responseNext.addEventListener("click", () => moveResponseSelection(1));
    elements.copyResponse.addEventListener("click", copySelectedResponse);
    elements.editResponse.addEventListener("click", toggleResponseEditing);

    elements.copyContact.addEventListener("click", copySelectedContactMessage);
    elements.copyPhone.addEventListener("click", copySelectedContactPhone);
    elements.editContact.addEventListener("click", () => {
      const contact = getSelectedContact();
      if (contact) openContactEditor(contact);
    });
    elements.addContact.addEventListener("click", () => openContactEditor());
    elements.importInternalContacts.addEventListener("click", () => elements.internalContactsFile.click());
    elements.internalContactsFile.addEventListener("change", importInternalContacts);

    elements.editorForm.addEventListener("submit", saveContactFromEditor);
    elements.editorCancel.addEventListener("click", closeContactEditor);
    elements.editorClose.addEventListener("click", closeContactEditor);
    elements.editorDelete.addEventListener("click", deleteContactFromEditor);
    elements.editor.addEventListener("close", () => {
      if (editorReturnFocus && document.contains(editorReturnFocus)) editorReturnFocus.focus();
      editorReturnFocus = null;
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !isEditableTarget(event.target) && !elements.editor.open) {
        event.preventDefault();
        const search = state.view === "responses" ? elements.responseSearch : elements.contactSearch;
        search.focus();
      }
    });
  }

  function switchView(view, focusSearch = true) {
    state.view = view === "contacts" ? "contacts" : "responses";
    elements.views.forEach((section) => {
      section.hidden = section.dataset.view !== state.view;
    });
    elements.navButtons.forEach((button) => {
      const active = button.dataset.viewTarget === state.view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (focusSearch) {
      const search = state.view === "responses" ? elements.responseSearch : elements.contactSearch;
      window.requestAnimationFrame(() => search.focus());
    }
  }

  function renderResponseFilters() {
    elements.responseFilters.innerHTML = RESPONSE_FILTERS.map((filter) => `
      <button class="filter-button${filter.id === state.responseFilter ? " active" : ""}"
        type="button" data-response-filter="${filter.id}"
        aria-pressed="${filter.id === state.responseFilter}">${filter.label}</button>
    `).join("");

    elements.responseFilters.querySelectorAll("[data-response-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.responseFilter = button.dataset.responseFilter;
        renderResponseFilters();
        filterResponses();
      });
    });
  }

  function filterResponses() {
    const source = responses.cotrap;
    const search = createSearchQuery(elements.responseSearch.value);
    const selectedFilter = RESPONSE_FILTERS.find((filter) => filter.id === state.responseFilter) || RESPONSE_FILTERS[0];
    const candidates = [];

    source.forEach((response, index) => {
      if (selectedFilter.categories && !selectedFilter.categories.includes(response.category)) return;
      const document = createSearchDocument([
        response.question,
        response.desc,
        response.keywords,
        response.text
      ]);
      const coverage = countSearchCoverage(document, search.terms);
      candidates.push({ index, coverage, score: scoreResponse(response, search) });
    });

    const matches = selectSearchMatches(candidates, search.terms.length);
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    state.responseIndices = matches.map((match) => match.index);
    if (!state.responseIndices.includes(state.selectedResponseIndex)) {
      state.selectedResponseIndex = state.responseIndices[0] ?? null;
      state.responseEditing = false;
    }
    renderResponseList();
    renderResponseDetail();
  }

  function renderResponseList() {
    elements.responseCount.textContent = `${state.responseIndices.length} ${state.responseIndices.length === 1 ? "risposta" : "risposte"}`;

    if (!state.responseIndices.length) {
      elements.responseList.innerHTML = `<div class="empty-state">Nessuna risposta trovata. Prova con meno parole o cambia categoria.</div>`;
      return;
    }

    elements.responseList.innerHTML = state.responseIndices.map((index) => {
      const response = responses.cotrap[index];
      const meta = CAT_META[response.category] || { label: response.category };
      return `
        <button class="answer-row${index === state.selectedResponseIndex ? " selected" : ""}"
          type="button" role="option" aria-selected="${index === state.selectedResponseIndex}"
          data-response-index="${index}">
          <span class="category-label" style="--category-color: var(--cat-${escapeAttribute(response.category)})">${escapeHtml(meta.label)}</span>
          <span class="row-copy">
            <span class="row-title">${escapeHtml(response.question)}</span>
            <span class="row-description">${escapeHtml(response.desc || "")}</span>
          </span>
          <span class="row-chevron" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span>
        </button>`;
    }).join("");

    elements.responseList.querySelectorAll("[data-response-index]").forEach((button) => {
      button.addEventListener("click", () => selectResponse(Number(button.dataset.responseIndex)));
    });
  }

  function selectResponse(index) {
    state.selectedResponseIndex = index;
    state.responseEditing = false;
    renderResponseList();
    renderResponseDetail();
  }

  function renderResponseDetail() {
    const response = getSelectedResponse();
    if (!response) {
      elements.responseQuestion.textContent = "Nessuna risposta selezionata";
      elements.responsePreview.innerHTML = `<div class="empty-state">Seleziona una risposta dall'elenco.</div>`;
      elements.responsePreview.hidden = false;
      elements.responseEditor.hidden = true;
      elements.responseAlert.hidden = true;
      elements.copyResponse.disabled = true;
      elements.editResponse.disabled = true;
      elements.responsePrev.disabled = true;
      elements.responseNext.disabled = true;
      return;
    }

    if (!state.responseEditing) state.responseDraft = response.text;
    elements.responseQuestion.textContent = response.question;
    elements.responsePreview.innerHTML = renderRichText(state.responseDraft);
    elements.responsePreview.hidden = state.responseEditing;
    elements.responseEditor.hidden = !state.responseEditing;
    elements.responseEditor.value = state.responseDraft;
    elements.editResponse.disabled = false;
    elements.editResponse.textContent = state.responseEditing ? "Anteprima" : "Modifica testo";

    const review = getResponseReview(response, state.responseDraft);
    elements.responseAlert.hidden = !review;
    elements.responseAlertText.textContent = review || "";
    updateResponseCopyState();

    const position = state.responseIndices.indexOf(state.selectedResponseIndex);
    elements.responsePrev.disabled = position <= 0;
    elements.responseNext.disabled = position < 0 || position >= state.responseIndices.length - 1;
  }

  function updateResponseCopyState() {
    const hasResponse = Boolean(getSelectedResponse());
    elements.copyResponse.disabled = !hasResponse || containsUnresolvedPlaceholder(state.responseDraft);
    elements.copyResponse.title = elements.copyResponse.disabled && hasResponse
      ? "Completa il testo tra parentesi prima di copiarlo"
      : "";
  }

  function toggleResponseEditing() {
    if (!getSelectedResponse()) return;
    state.responseEditing = !state.responseEditing;
    renderResponseDetail();
    if (state.responseEditing) elements.responseEditor.focus();
  }

  function moveResponseSelection(direction) {
    const currentPosition = state.responseIndices.indexOf(state.selectedResponseIndex);
    const nextPosition = currentPosition + direction;
    if (nextPosition < 0 || nextPosition >= state.responseIndices.length) return;
    selectResponse(state.responseIndices[nextPosition]);
  }

  async function copySelectedResponse() {
    if (!state.responseDraft || containsUnresolvedPlaceholder(state.responseDraft)) return;
    await copyRichText(state.responseDraft, "Risposta copiata");
  }

  function renderContactFilters() {
    const topics = [...new Set(state.contacts.flatMap((contact) => contact.topics || []))];
    const filters = [{ id: "all", label: "Tutti" }, ...topics.map((topic) => ({ id: topic, label: topic }))];
    if (!filters.some((filter) => filter.id === state.contactFilter)) state.contactFilter = "all";

    elements.contactFilters.innerHTML = filters.map((filter) => `
      <button class="filter-button${filter.id === state.contactFilter ? " active" : ""}"
        type="button" data-contact-filter="${escapeAttribute(filter.id)}"
        aria-pressed="${filter.id === state.contactFilter}">${escapeHtml(filter.label)}</button>
    `).join("");

    elements.contactFilters.querySelectorAll("[data-contact-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.contactFilter = button.dataset.contactFilter;
        renderContactFilters();
        filterContacts();
      });
    });
  }

  function filterContacts() {
    const search = createSearchQuery(elements.contactSearch.value);
    const candidates = [];

    state.contacts.forEach((contact, index) => {
      if (state.contactFilter !== "all" && !(contact.topics || []).includes(state.contactFilter)) return false;
      const document = createSearchDocument([
        contact.useCase,
        contact.office,
        contact.location,
        (contact.internalPeople || []).join(" "),
        contact.phone,
        contact.email,
        (contact.otherEmails || []).join(" "),
        contact.site,
        (contact.topics || []).join(" "),
        contact.keywords,
        getContactSearchLabels(contact),
        contact.message
      ]);
      candidates.push({
        id: contact.id,
        index,
        coverage: countSearchCoverage(document, search.terms),
        score: scoreContact(contact, search)
      });
    });

    const matches = selectSearchMatches(candidates, search.terms.length);
    matches.sort((a, b) => b.score - a.score || a.index - b.index);
    state.contactIds = matches.map((match) => match.id);

    if (!state.contactIds.includes(state.selectedContactId)) {
      state.selectedContactId = state.contactIds[0] ?? null;
    }
    renderContactList();
    renderContactDetail();
  }

  function renderContactList() {
    elements.contactCount.textContent = `${state.contactIds.length} ${state.contactIds.length === 1 ? "contatto" : "contatti"}`;

    if (!state.contactIds.length) {
      elements.contactList.innerHTML = `<div class="empty-state">Nessun contatto trovato. Puoi cambiare ricerca oppure aggiungerne uno nuovo.</div>`;
      return;
    }

    const rows = state.contactIds.map((id) => {
      const contact = state.contacts.find((item) => item.id === id);
      if (!contact) return "";
      return `
        <button class="contact-row${contact.id === state.selectedContactId ? " selected" : ""}"
          type="button" role="option" aria-selected="${contact.id === state.selectedContactId}"
          data-contact-id="${escapeAttribute(contact.id)}">
          <span class="contact-cell" data-label="Azienda"><strong>${escapeHtml(contact.office)}</strong>${contact.location ? `<br>${escapeHtml(contact.location)}` : ""}</span>
          <span class="contact-cell contact-phone" data-label="Telefono pubblico">${phoneIcon()} ${escapeHtml(contact.phone || "Non pubblicato")}</span>
          <span class="contact-cell" data-label="Email principale">${escapeHtml(contact.email || "Non pubblicata")}</span>
          <span class="contact-cell" data-label="Referenti interni">${(contact.internalPeople || []).length ? `${contact.internalPeople.length} presenti` : "Da inserire"}</span>
        </button>`;
    }).join("");

    elements.contactList.innerHTML = rows;
    elements.contactList.querySelectorAll("[data-contact-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedContactId = button.dataset.contactId;
        renderContactList();
        renderContactDetail();
      });
    });
  }

  function renderContactDetail() {
    const contact = getSelectedContact();
    if (!contact) {
      elements.contactTitle.textContent = "Messaggio per il cliente";
      elements.contactMessage.innerHTML = `<div class="empty-state">Seleziona un contatto dall'elenco.</div>`;
      elements.contactMeta.innerHTML = "";
      elements.copyContact.disabled = true;
      elements.copyPhone.disabled = true;
      elements.editContact.disabled = true;
      return;
    }

    elements.contactTitle.textContent = "Messaggio per il cliente";
    elements.contactMessage.innerHTML = renderRichText(contact.message || buildDefaultContactMessage(contact));
    const publicEmails = [contact.email, ...(contact.otherEmails || [])].filter(Boolean);
    const internalPeople = (contact.internalPeople || []).map((person) => `<li>${escapeHtml(person)}</li>`).join("");
    elements.contactMeta.innerHTML = `
      <div class="meta-block"><span>Azienda / ufficio</span><strong>${escapeHtml([contact.office, contact.location].filter(Boolean).join(" · "))}</strong></div>
      <div class="meta-block"><span>Telefono pubblico</span><strong>${escapeHtml(contact.phone || "Non pubblicato")}</strong></div>
      <div class="meta-block"><span>Email pubbliche</span><strong>${publicEmails.map(escapeHtml).join("<br>") || "Non pubblicate"}</strong></div>
      <div class="meta-block"><span>Sito</span><strong>${escapeHtml(contact.site || "Non pubblicato")}</strong></div>
      <div class="meta-block internal-contact-block"><span>Uso interno · solo in questo browser</span>${internalPeople ? `<ul>${internalPeople}</ul>` : "<strong>Nessun referente nominativo inserito</strong>"}</div>`;
    elements.copyContact.disabled = false;
    elements.copyPhone.disabled = !contact.phone;
    elements.editContact.disabled = false;
  }

  async function copySelectedContactMessage() {
    const contact = getSelectedContact();
    if (!contact) return;
    await copyRichText(contact.message || buildDefaultContactMessage(contact), "Messaggio copiato");
  }

  async function copySelectedContactPhone() {
    const contact = getSelectedContact();
    if (!contact?.phone) return;
    await copyPlainText(contact.phone, "Numero copiato");
  }

  function openContactEditor(contact = null) {
    editorReturnFocus = document.activeElement;
    resetDeleteConfirmation();
    elements.editorForm.reset();
    elements.editorForm.elements.id.value = contact?.id || "";
    elements.editorForm.elements.useCase.value = contact?.useCase || "";
    elements.editorForm.elements.topics.value = (contact?.topics || []).join(", ");
    elements.editorForm.elements.office.value = contact?.office || "";
    elements.editorForm.elements.location.value = contact?.location || "";
    elements.editorForm.elements.internalPeople.value = (contact?.internalPeople || []).join("\n");
    elements.editorForm.elements.phone.value = contact?.phone || "";
    elements.editorForm.elements.email.value = contact?.email || "";
    elements.editorForm.elements.otherEmails.value = (contact?.otherEmails || []).join("\n");
    elements.editorForm.elements.site.value = contact?.site || "";
    elements.editorForm.elements.keywords.value = contact?.keywords || "";
    elements.editorForm.elements.message.value = contact?.message || "";
    elements.editorTitle.textContent = contact ? "Modifica contatto" : "Nuovo contatto";
    elements.editorDelete.hidden = !contact;
    elements.editor.showModal();
    window.requestAnimationFrame(() => elements.editorForm.elements.useCase.focus());
  }

  function closeContactEditor() {
    resetDeleteConfirmation();
    if (elements.editor.open) elements.editor.close();
  }

  function saveContactFromEditor(event) {
    event.preventDefault();
    const form = elements.editorForm.elements;
    const existingId = form.id.value.trim();
    const contact = {
      id: existingId || makeContactId(form.office.value, form.useCase.value),
      topics: splitList(form.topics.value, /[,;\n]+/),
      useCase: form.useCase.value.trim(),
      office: form.office.value.trim(),
      location: form.location.value.trim(),
      internalPeople: splitList(form.internalPeople.value, /\n+/),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      otherEmails: splitList(form.otherEmails.value, /\n+/),
      site: form.site.value.trim(),
      keywords: form.keywords.value.trim(),
      message: form.message.value.trim()
    };
    if (!contact.message) contact.message = buildDefaultContactMessage(contact);

    const existingIndex = state.contacts.findIndex((item) => item.id === existingId);
    if (existingIndex >= 0) state.contacts.splice(existingIndex, 1, contact);
    else state.contacts.push(contact);

    state.selectedContactId = contact.id;
    saveContacts();
    closeContactEditor();
    renderContactFilters();
    filterContacts();
    showToast("Contatto salvato");
  }

  function deleteContactFromEditor() {
    const id = elements.editorForm.elements.id.value;
    const contact = state.contacts.find((item) => item.id === id);
    if (!contact) return;
    if (!deleteArmed) {
      deleteArmed = true;
      elements.editorDelete.textContent = "Conferma eliminazione";
      elements.editorDelete.setAttribute("aria-label", `Conferma eliminazione di ${contact.useCase}`);
      window.clearTimeout(deleteArmTimer);
      deleteArmTimer = window.setTimeout(resetDeleteConfirmation, 15000);
      return;
    }
    state.contacts = state.contacts.filter((item) => item.id !== id);
    state.selectedContactId = null;
    saveContacts();
    closeContactEditor();
    renderContactFilters();
    filterContacts();
    showToast("Contatto eliminato");
  }

  function resetDeleteConfirmation() {
    deleteArmed = false;
    window.clearTimeout(deleteArmTimer);
    if (elements.editorDelete) {
      elements.editorDelete.textContent = "Elimina";
      elements.editorDelete.setAttribute("aria-label", "Elimina contatto");
    }
  }

  function loadContacts() {
    const defaults = cloneContacts(window.DEFAULT_EXTERNAL_CONTACTS || []);
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved)) {
        const savedById = new Map(saved.filter(isValidContact).map((item) => [item.id, item]));
        const merged = defaults.map((item) => normalizeContact({ ...item, ...(savedById.get(item.id) || {}) }));
        saved.filter((item) => isValidContact(item) && !defaults.some((base) => base.id === item.id))
          .forEach((item) => merged.push(normalizeContact(item)));
        return merged;
      }

      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY));
      if (Array.isArray(legacy)) {
        const formerAgency = legacy.find((item) => item?.id === "agenzia-sabato-gioia-scoppio");
        const names = splitList((formerAgency?.people || []).join("\n"), /\n+/);
        if (names.length) {
          defaults.filter((item) => ["sabato", "scoppio"].includes(item.id))
            .forEach((item) => { item.internalPeople = names; });
        }
      }
      return defaults.map(normalizeContact);
    } catch {
      return defaults.map(normalizeContact);
    }
  }

  function isValidContact(item) {
    return Boolean(item && typeof item.id === "string" && typeof item.useCase === "string");
  }

  function normalizeContact(contact) {
    return {
      ...contact,
      topics: Array.isArray(contact.topics) ? contact.topics : [],
      internalPeople: Array.isArray(contact.internalPeople) ? contact.internalPeople : (Array.isArray(contact.people) ? contact.people : []),
      otherEmails: Array.isArray(contact.otherEmails) ? contact.otherEmails : [],
      phone: contact.phone || "",
      email: contact.email || "",
      site: contact.site || ""
    };
  }

  async function importInternalContacts(event) {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error("Formato non valido");
      let updated = 0;
      data.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        const key = normalizeSearchText(entry.id || entry.office || entry.company || "");
        const contact = state.contacts.find((item) => item.id === entry.id || normalizeSearchText(item.office) === key);
        if (!contact) return;
        const people = Array.isArray(entry.internalPeople) ? entry.internalPeople : (Array.isArray(entry.contacts) ? entry.contacts : []);
        contact.internalPeople = people.map(formatInternalPerson).filter(Boolean);
        updated += 1;
      });
      if (!updated) throw new Error("Nessuna azienda riconosciuta");
      saveContacts();
      filterContacts();
      showToast(`${updated} ${updated === 1 ? "azienda aggiornata" : "aziende aggiornate"}`);
    } catch {
      showToast("File non valido: controlla nomi delle aziende e formato JSON");
    }
  }

  function formatInternalPerson(person) {
    if (typeof person === "string") return person.trim();
    if (!person || typeof person !== "object") return "";
    return [person.name, person.role, person.email, person.phone].map((value) => String(value || "").trim()).filter(Boolean).join(" — ");
  }

  function saveContacts() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.contacts));
    } catch {
      showToast("Contatto aggiornato solo per questa sessione");
    }
  }

  function cloneContacts(contacts) {
    return JSON.parse(JSON.stringify(contacts));
  }

  function getSelectedResponse() {
    if (state.selectedResponseIndex == null) return null;
    return responses.cotrap[state.selectedResponseIndex] || null;
  }

  function getSelectedContact() {
    return state.contacts.find((contact) => contact.id === state.selectedContactId) || null;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeSearchText(value) {
    const normalized = normalizeSearchText(value);
    const words = normalized
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    return [...new Set([...words, ...extractCompactAcronyms(normalized)])];
  }

  function createSearchQuery(value) {
    const normalized = normalizeSearchText(value);
    const originalTerms = tokenizeSearchText(value);
    const meaningfulTerms = originalTerms.filter((term) => !SEARCH_STOP_WORDS.has(term));
    const terms = meaningfulTerms.length ? meaningfulTerms : originalTerms;
    const conceptKeys = new Set();
    return {
      normalized,
      terms: terms.filter((term) => {
        const equivalents = SEARCH_EQUIVALENTS.get(term);
        const key = equivalents ? `group:${equivalents[0]}` : `term:${stemSearchToken(term)}`;
        if (conceptKeys.has(key)) return false;
        conceptKeys.add(key);
        return true;
      })
    };
  }

  function createSearchDocument(parts) {
    const text = (Array.isArray(parts) ? parts : [parts]).filter(Boolean).join(" ");
    const compactNumbers = extractCompactNumbers(text);
    const tokens = [...new Set([...tokenizeSearchText(text), ...compactNumbers])];
    return {
      normalized: [normalizeSearchText(text), ...compactNumbers].filter(Boolean).join(" "),
      tokens,
      tokenSet: new Set(tokens)
    };
  }

  function extractCompactNumbers(value) {
    const matches = String(value || "").match(/(?:\+?\d[\d\s()./-]{5,}\d)/g) || [];
    return [...new Set(matches.map((match) => match.replace(/\D/g, "")).filter((digits) => digits.length >= 7))];
  }

  function extractCompactAcronyms(value) {
    const matches = String(value || "").match(/\b(?:[a-z]\.){2,}[a-z]?\.?/g) || [];
    return [...new Set(matches.map((match) => match.replace(/[^a-z]/g, "")).filter((term) => term.length >= 2))];
  }

  function getSearchVariants(term) {
    const equivalents = SEARCH_EQUIVALENTS.get(term) || [];
    return [term, ...equivalents.filter((variant) => variant !== term)];
  }

  function stemSearchToken(term) {
    if (!/^[a-z]+$/.test(term) || term.length < 5) return term;
    const stem = term.replace(/[aeiou]+$/g, "");
    return stem.length >= 4 ? stem : term;
  }

  function matchSearchTerm(term, document) {
    let best = 0;
    const variants = getSearchVariants(term);

    variants.forEach((variant) => {
      if (document.tokenSet.has(variant)) {
        best = Math.max(best, 4);
        return;
      }

      const variantStem = stemSearchToken(variant);
      document.tokens.forEach((token) => {
        if (variant.length >= 4 && token.startsWith(variant)) {
          best = Math.max(best, 3);
        } else if (variantStem.length >= 4 && variantStem === stemSearchToken(token)) {
          best = Math.max(best, 3);
        }
      });
    });

    if (best || !/^[a-z]+$/.test(term) || term.length < 5) return best;
    const tolerance = term.length >= 9 ? 2 : 1;
    const fuzzyMatch = document.tokens.some((token) => {
      if (!/^[a-z]+$/.test(token) || token[0] !== term[0] || Math.abs(token.length - term.length) > tolerance) return false;
      return damerauLevenshtein(term, token, tolerance) <= tolerance;
    });
    return fuzzyMatch ? 1 : 0;
  }

  function countSearchCoverage(document, terms) {
    if (!terms.length) return 0;
    return terms.reduce((count, term) => count + (matchSearchTerm(term, document) ? 1 : 0), 0);
  }

  function selectSearchMatches(candidates, termCount) {
    if (!termCount) return candidates;
    const completeMatches = candidates.filter((candidate) => candidate.coverage === termCount);
    if (completeMatches.length) return completeMatches;
    const minimumCoverage = Math.max(1, Math.ceil(termCount * 0.5));
    return candidates.filter((candidate) => candidate.coverage >= minimumCoverage);
  }

  function scoreSearchField(value, terms, weight) {
    if (!terms.length) return 0;
    const document = createSearchDocument(value);
    return terms.reduce((score, term) => score + matchSearchTerm(term, document) * weight, 0);
  }

  function scoreResponse(response, search) {
    if (!search.terms.length) return 0;
    const title = normalizeSearchText(response.question);
    let score = search.normalized && title.includes(search.normalized) ? 180 : 0;
    score += scoreSearchField(response.question, search.terms, 18);
    score += scoreSearchField(response.keywords, search.terms, 10);
    score += scoreSearchField(response.desc, search.terms, 5);
    score += scoreSearchField(response.text, search.terms, 1);
    return score;
  }

  function scoreContact(contact, search) {
    if (!search.terms.length) return 0;
    const office = normalizeSearchText(contact.office);
    let score = search.normalized && office.includes(search.normalized) ? 180 : 0;
    score += scoreSearchField(contact.office, search.terms, 18);
    score += scoreSearchField(contact.location, search.terms, 12);
    score += scoreSearchField((contact.internalPeople || []).join(" "), search.terms, 10);
    score += scoreSearchField([contact.phone, contact.email, ...(contact.otherEmails || [])].join(" "), search.terms, 10);
    score += scoreSearchField([(contact.topics || []).join(" "), contact.keywords, contact.useCase, getContactSearchLabels(contact)].join(" "), search.terms, 8);
    score += scoreSearchField(contact.message, search.terms, 1);
    return score;
  }

  function getContactSearchLabels(contact) {
    const labels = [];
    if (contact.phone) labels.push("telefono numero chiamare");
    if (contact.email || (contact.otherEmails || []).length) labels.push("email mail posta");
    if ([contact.email, ...(contact.otherEmails || [])].join(" ").toLowerCase().includes("pec")) labels.push("pec");
    if (contact.site) labels.push("sito web");
    return labels.join(" ");
  }

  function damerauLevenshtein(left, right, maxDistance) {
    if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;
    let previousPrevious = null;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let rowMinimum = current[0];
      for (let column = 1; column <= right.length; column += 1) {
        const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
        let distance = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + substitutionCost
        );
        if (
          previousPrevious && row > 1 && column > 1 &&
          left[row - 1] === right[column - 2] &&
          left[row - 2] === right[column - 1]
        ) {
          distance = Math.min(distance, previousPrevious[column - 2] + 1);
        }
        current[column] = distance;
        rowMinimum = Math.min(rowMinimum, distance);
      }
      if (rowMinimum > maxDistance) return maxDistance + 1;
      previousPrevious = previous;
      previous = current;
    }

    return previous[right.length];
  }

  function renderRichText(plain) {
    return String(plain || "").split("\n").map((line) => {
      let html = escapeHtml(line).replace(URL_RE, (match) => {
        const trailing = (match.match(/[),.;:!?]+$/) || [""])[0];
        const url = trailing ? match.slice(0, -trailing.length) : match;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>${trailing}`;
      });
      if (isHeaderLine(line)) html = `<span class="line-header">${html}</span>`;
      return html;
    }).join("\n");
  }

  function isHeaderLine(line) {
    const text = line.trim();
    if (!text.endsWith(":")) return false;
    const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (letters.length < 2) return false;
    const uppercase = (letters.match(/[A-ZÀ-Ý]/g) || []).length;
    return uppercase / letters.length >= 0.7;
  }

  function getResponseReview(response, text) {
    if (containsUnresolvedPlaceholder(text)) return "Completa i dati indicati tra parentesi prima di copiare la risposta.";
    return response.reviewNote || "";
  }

  function containsUnresolvedPlaceholder(text) {
    return /\[[^\]]*(MODIFICARE|INSERIRE|COMPLETARE)[^\]]*\]/i.test(text || "");
  }

  function buildDefaultContactMessage(contact) {
    const office = [contact.office, contact.location ? `di ${contact.location}` : ""].filter(Boolean).join(" ");
    const contacts = [
      contact.phone ? `Telefono: ${contact.phone}` : "",
      contact.email ? `Email: ${contact.email}` : "",
      ...(contact.otherEmails || []),
      contact.site ? `Sito: ${normalizeWebsite(contact.site)}` : ""
    ].filter(Boolean);
    return [
      "Gentile Cliente,",
      "",
      `per ${contact.useCase.toLowerCase()} può contattare ${office}.`,
      "",
      ...(contacts.length ? contacts : ["Al momento non risultano recapiti pubblici verificati. Consulti la scheda dell'azienda sul sito COTRAP."]),
      "",
      "Cordiali saluti"
    ].filter((line, index, all) => line || (index > 0 && all[index - 1] !== "")).join("\n");
  }

  function normalizeWebsite(site) {
    if (!site) return "";
    return /^https?:\/\//i.test(site) ? site : `https://${site.replace(/^www\./i, "")}`;
  }

  function splitList(value, separator) {
    return String(value || "").split(separator).map((item) => item.trim()).filter(Boolean);
  }

  function makeContactId(office, useCase) {
    const base = normalizeSearchText(`${office}-${useCase}`)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "contatto";
    return `${base}-${Date.now().toString(36)}`;
  }

  function isEditableTarget(target) {
    return target instanceof HTMLElement && (target.matches("input, textarea, [contenteditable='true']") || target.closest("dialog"));
  }

  async function copyRichText(plainText, successMessage) {
    const normalized = String(plainText).replace(/\r?\n/g, "\r\n").trim();
    const html = normalized.split(/\r\n\r\n/).map((paragraph) =>
      `<p style="margin:0 0 12px;font:14px/1.55 Arial,sans-serif;color:#24292f">${renderRichText(paragraph).replace(/\n/g, "<br>")}</p>`
    ).join("");
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          "text/plain": new Blob([normalized], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        })]);
      } else {
        await navigator.clipboard.writeText(normalized);
      }
      showToast(successMessage);
    } catch {
      await copyPlainText(normalized, successMessage);
    }
  }

  async function copyPlainText(text, successMessage) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    showToast(successMessage);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 1800);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function phoneIcon() {
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.5 9 7.7 6.8 9.2a14 14 0 0 0 8 8l1.5-2.2 4.2 1.8v2.1a2 2 0 0 1-2 2A15.5 15.5 0 0 1 3.1 5.5a2 2 0 0 1 2-2h2.1Z"/></svg>`;
  }
})();
