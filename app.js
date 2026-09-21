(() => {
  "use strict";

  const STORAGE_KEY = "risponditore.externalContacts.v2";
  const LEGACY_STORAGE_KEY = "risponditore.externalContacts.v1";
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
    const query = normalizeSearchText(elements.responseSearch.value);
    const words = query.split(/\s+/).filter(Boolean);
    const selectedFilter = RESPONSE_FILTERS.find((filter) => filter.id === state.responseFilter) || RESPONSE_FILTERS[0];
    const matches = [];

    source.forEach((response, index) => {
      if (selectedFilter.categories && !selectedFilter.categories.includes(response.category)) return;
      const blob = normalizeSearchText([
        response.question,
        response.desc,
        response.keywords,
        response.text
      ].join(" "));
      if (words.length && !words.every((word) => blob.includes(word))) return;
      matches.push({ index, score: scoreResponse(response, words, query) });
    });

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
    const query = normalizeSearchText(elements.contactSearch.value);
    const words = query.split(/\s+/).filter(Boolean);

    state.contactIds = state.contacts.filter((contact) => {
      if (state.contactFilter !== "all" && !(contact.topics || []).includes(state.contactFilter)) return false;
      const blob = normalizeSearchText([
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
        contact.message
      ].join(" "));
      return words.every((word) => blob.includes(word));
    }).map((contact) => contact.id);

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

  function scoreResponse(response, words, query) {
    if (!words.length) return 0;
    const title = normalizeSearchText(response.question);
    const description = normalizeSearchText(response.desc);
    const keywords = normalizeSearchText(response.keywords);
    const body = normalizeSearchText(response.text);
    let score = title.includes(query) ? 140 : 0;
    words.forEach((word) => {
      if (title.includes(word)) score += 60;
      if (keywords.includes(word)) score += 32;
      if (description.includes(word)) score += 16;
      if (body.includes(word)) score += 4;
    });
    return score;
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
