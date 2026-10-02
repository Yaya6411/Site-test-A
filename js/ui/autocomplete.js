"use strict";

/* =========================================================================
 *  Autocomplétion : propose auteurs, livres incontournables et genres
 *  pendant la saisie, sans aucune requête réseau (index local).
 * ========================================================================= */

function attachAutocomplete(input, { types = null, onPick = null } = {}) {
  const wrap = input.parentElement;
  wrap.classList.add("ac-wrap");
  const list = document.createElement("ul");
  list.className = "ac-list";
  list.id = `${input.id}-suggestions`;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrap.appendChild(list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  let items = [];
  let active = -1;

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function highlight(i) {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    if (i >= 0) input.setAttribute("aria-activedescendant", `${list.id}-${i}`);
  }

  function pick(entry) {
    close();
    input.value = entry.label;
    if (onPick) onPick(entry);
    else location.hash = entry.href;
  }

  input.addEventListener("input", () => {
    items = suggest(input.value, 8, types);
    if (!items.length) return close();
    list.innerHTML = items.map((e, i) => `
      <li id="${list.id}-${i}" role="option" aria-selected="false" data-i="${i}">
        <span class="ac-type">${esc(e.type)}</span>
        <span class="ac-label">${esc(e.label)}</span>
        <span class="ac-sub">${esc(e.sub)}</span>
      </li>`).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    active = -1;
  });

  input.addEventListener("keydown", e => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); highlight((active + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight((active - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") close();
  });

  // mousedown plutôt que click : se déclenche avant la perte du focus.
  list.addEventListener("mousedown", e => {
    const li = e.target.closest("li[data-i]");
    if (li) { e.preventDefault(); pick(items[Number(li.dataset.i)]); }
  });
  input.addEventListener("blur", () => setTimeout(close, 100));
}
