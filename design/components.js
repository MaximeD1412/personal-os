// design/components.js: the library (classic script, no module). Light DOM custom elements,
// rendered once in connectedCallback. Catalogue: DESIGN.md « Components ».
(() => {
  const define = (name, render) => customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      if (this.rendered) return;
      this.rendered = true;
      render(this);
    }
  });

  // Element helper: h("div", { class: "x", "data-name": "Y" }, ...children)
  const h = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  };
  // Children of an element that carry slot="<name>", detached (moved, never copied).
  const take = (el, slot) => [...el.children].filter((c) => c.getAttribute("slot") === slot).map((c) => { c.remove(); return c; });
  // The remaining children (default slot).
  const rest = (el) => [...el.childNodes].map((c) => { c.remove(); return c; });
  const attr = (el, name, fallback = null) => (el.hasAttribute(name) ? el.getAttribute(name) : fallback);
  const pascal = (s) => s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");

  // ---------- Icons (24 × 24, stroke) ----------
  const ICONS = {
    "home": "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    "grid": "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    "list": "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    "calendar": "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18",
    "dumbbell": "M6.5 6.5l11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7",
    "utensils": "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7",
    "book": "M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z",
    "archive": "M3 4h18v4H3zM5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4",
    "cart": "M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6",
    "wallet": "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
    "folder": "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z",
    "building": "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4",
    "rocket": "M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5",
    "briefcase": "M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
    "file": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    "backup": "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2",
    "hub": "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
    "settings": "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    "help": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
    "search": "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    "terminal": "M4 17l6-6-6-6M12 19h8",
    "moon": "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z",
    "user": "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "users": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
    "logout": "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    "arrow-right": "M5 12h14M12 5l7 7-7 7",
    "arrow-down": "M12 5v14M19 12l-7 7-7-7",
    "chevron-right": "M9 18l6-6-6-6",
    "chevron-left": "M15 18l-6-6 6-6",
    "plus": "M12 5v14M5 12h14",
    "minus": "M5 12h14",
    "plus-circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v8M8 12h8",
    "bolt": "M13 2 3 14h9l-1 8 10-12h-9z",
    "flag": "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
    "clock": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
    "timer": "M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
    "mountain": "M8 3l4 8 5-5 5 15H2z",
    "chart": "M3 3v18h18M7 16v-3M12 16V8M17 16v-6",
    "route": "M6 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15",
    "trend-up": "M22 7l-8.5 8.5-5-5L2 17M16 7h6v6",
    "check": "M20 6 9 17l-5-5",
    "check-circle": "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
    "x": "M18 6 6 18M6 6l12 12",
    "x-circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6",
    "pencil": "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
    "notes": "M17 10H3M21 6H3M21 14H3M17 18H3",
    "smile": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    "thumbs-up": "M7 10v12M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z",
    "menu": "M4 6h16M4 12h16M4 18h16",
    "more": "M5 12h.01M12 12h.01M19 12h.01",
    "alert": "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
    "info": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
    "server": "M4 2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4 14h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zM6 6h.01M6 18h.01",
    "star": "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
    "heart": "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
    "bookmark": "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    "shield-check": "M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1zM9 12l2 2 4-4",
    "grip": "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
    "sparkles": "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM5 3v4M3 5h4M19 17v4M17 19h4",
    "refresh": "M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5",
    "leaf": "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10zM2 21c0-3 1.9-5.4 5.1-6",
    "merge": "M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 6v12M16 11c-4 0-8-1-8-5",
    "image": "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21",
    "sliders": "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    "cake": "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01",
    "receipt": "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM16 8H8M16 12H8M13 16H8",
  };
  const SIZES = new Set(["sm", "md", "lg", "xl", "hero"]);
  const icon = (name, size = "md") => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", name === "more" || name === "grip" ? "3" : "1.75");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `icon icon--${SIZES.has(size) ? size : "md"}`);
    svg.dataset.name = `Icon/${pascal(name)}`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICONS[name] || ICONS["info"]);
    svg.append(path);
    return svg;
  };

  // <ui-icon name="home" size="sm|md|lg|xl|hero">
  define("ui-icon", (el) => el.append(icon(attr(el, "name", "info"), attr(el, "size", "md"))));

  // <ui-badge tone="success|warning|error|info|neutral|solid-warning" dot icon="…">Label</ui-badge>
  define("ui-badge", (el) => {
    const tone = attr(el, "tone", "info");
    const badge = h("span", { class: `badge badge--${tone}`, "data-name": `Badge/${pascal(tone)}` },
      el.hasAttribute("dot") ? h("span", { class: "badge__dot", "data-name": "Dot" }) : null,
      el.hasAttribute("icon") ? icon(el.getAttribute("icon"), "sm") : null,
      h("span", { "data-name": "Label" }, ...rest(el)));
    el.append(badge);
  });

  // <ui-tag tone="primary|secondary|tertiary|error" variant="category">Label</ui-tag>
  define("ui-tag", (el) => {
    const tone = attr(el, "tone");
    const variant = attr(el, "variant");
    el.append(h("span", {
      class: ["tag", "t-label", tone && `tag--${tone}`, variant && `tag--${variant}`].filter(Boolean).join(" "),
      "data-name": variant === "category" ? "Tag/Category" : "Tag/Keyword",
    }, el.hasAttribute("icon") ? icon(el.getAttribute("icon"), "sm") : null, ...rest(el)));
  });

  // <ui-button variant="primary|secondary|ghost|success|warning|destructive" size="sm|md|lg" icon="plus" icon-end="arrow-right" state="disabled" block>Label</ui-button>
  define("ui-button", (el) => {
    const variant = attr(el, "variant", "primary");
    const size = attr(el, "size", "md");
    const label = rest(el);
    const button = h("button", {
      type: "button",
      class: ["button", `button--${variant}`, size !== "md" && `button--${size}`, el.hasAttribute("block") && "button--block"].filter(Boolean).join(" "),
      "data-name": `Button/${pascal(variant)}`,
      disabled: attr(el, "state") === "disabled",
      "aria-label": label.length ? null : attr(el, "label"),
    },
    el.hasAttribute("icon") ? icon(el.getAttribute("icon"), size === "lg" ? "lg" : "md") : null,
    label.length ? h("span", { "data-name": "Label" }, ...label) : null,
    el.hasAttribute("icon-end") ? icon(el.getAttribute("icon-end"), "sm") : null);
    el.append(button);
  });

  // <ui-icon-button icon="moon" label="Thème">
  define("ui-icon-button", (el) => {
    el.append(h("button", { type: "button", class: "icon-button", "aria-label": attr(el, "label"), "data-name": "IconButton" }, icon(attr(el, "icon", "more"), attr(el, "size", "md"))));
  });

  // <ui-search placeholder="…" shortcut="⌘K" icon="search">
  define("ui-search", (el) => {
    el.append(h("label", { class: "search t-body", "data-name": "Search" },
      icon(attr(el, "icon", "search"), "md"),
      h("input", { type: "search", placeholder: attr(el, "placeholder", "Rechercher"), "aria-label": attr(el, "placeholder", "Rechercher") }),
      el.hasAttribute("shortcut") ? h("kbd", { class: "kbd t-mono", "data-name": "Shortcut" }, el.getAttribute("shortcut")) : null));
  });

  // <ui-segmented label="…"><ui-segment pressed count="4" icon="…">Label</ui-segment>…</ui-segmented>
  define("ui-segmented", (el) => {
    const group = h("div", { class: `segmented${el.hasAttribute("scroll") ? " segmented--scroll" : ""}`, role: "group", "aria-label": attr(el, "label"), "data-name": "Segmented" }, ...rest(el));
    el.append(group);
  });
  define("ui-segment", (el) => {
    el.style.display = "contents";
    el.append(h("button", { type: "button", class: "segmented__item", "aria-pressed": el.hasAttribute("pressed") ? "true" : "false", "data-name": "Segmented/Item" },
      el.hasAttribute("icon") ? icon(el.getAttribute("icon"), "sm") : null,
      h("span", { "data-name": "Label" }, ...rest(el)),
      el.hasAttribute("count") ? h("span", { class: "segmented__count t-micro", "data-name": "Count" }, el.getAttribute("count")) : null));
  });

  // <ui-tabs label="…"><ui-tab selected count="42" hint="/nouvelle">Recettes</ui-tab>…</ui-tabs>
  define("ui-tabs", (el) => {
    el.append(h("div", { class: "tabs", role: "tablist", "aria-label": attr(el, "label"), "data-name": "Tabs" }, ...rest(el)));
  });
  define("ui-tab", (el) => {
    el.style.display = "contents";
    el.append(h("button", { type: "button", role: "tab", class: "tabs__item", "aria-selected": el.hasAttribute("selected") ? "true" : "false", "data-name": "Tabs/Item" },
      h("span", { "data-name": "Label" }, ...rest(el)),
      el.hasAttribute("hint") ? h("span", { class: "t-mono c-muted" }, el.getAttribute("hint")) : null,
      el.hasAttribute("count") ? h("span", { class: "segmented__count t-micro", "data-name": "Count" }, el.getAttribute("count")) : null));
  });

  // <ui-page-header crumbs="Organisation|Sport" title="…" subtitle="…" icon="dumbbell">actions</ui-page-header>
  define("ui-page-header", (el) => {
    const crumbs = attr(el, "crumbs");
    const actions = rest(el);
    el.append(h("header", { class: "page-header", "data-name": "PageHeader" },
      h("div", { class: "page-header__text" },
        crumbs ? h("nav", { class: "page-header__crumbs t-micro", "aria-label": "Fil d'Ariane", "data-name": "Breadcrumb" },
          ...crumbs.split("|").flatMap((c, i) => (i ? [icon("chevron-right", "sm"), h("span", {}, c)] : [h("span", {}, c)]))) : null,
        h("div", { class: "page-header__title" },
          el.hasAttribute("icon") ? h("span", { class: "page-header__badge", "data-name": "PillarIcon" }, icon(el.getAttribute("icon"), "lg")) : null,
          h("h1", { "data-name": "Title" }, attr(el, "title", ""))),
        el.hasAttribute("subtitle") ? h("p", { class: "page-header__subtitle t-body", "data-name": "Subtitle" }, el.getAttribute("subtitle")) : null),
      actions.length ? h("div", { class: "page-header__actions", "data-name": "Actions" }, ...actions) : null));
  });

  // <ui-card title="…" subtitle="…" icon="…" tone="primary|secondary|tertiary|error"> <x slot="aside"> body <x slot="footer"> </ui-card>
  define("ui-card", (el) => {
    const aside = take(el, "aside");
    const footer = take(el, "footer");
    const tone = attr(el, "tone");
    const body = rest(el);
    const title = attr(el, "title");
    el.append(h("section", { class: "card", "data-name": `Card/${title ? "Titled" : "Plain"}` },
      title ? h("div", { class: "card__header", "data-name": "Header" },
        el.hasAttribute("icon") ? h("span", { class: `card__icon${tone ? ` tone-${tone}` : ""}`, "data-name": "Icon" }, icon(el.getAttribute("icon"), "lg")) : null,
        h("div", { class: "card__heading" },
          h("h2", { class: "card__title", "data-name": "Title" }, title),
          el.hasAttribute("subtitle") ? h("p", { class: "card__subtitle t-label", "data-name": "Subtitle" }, el.getAttribute("subtitle")) : null),
        aside.length ? h("div", { class: "card__aside", "data-name": "Aside" }, ...aside) : null) : null,
      body.length ? h("div", { class: "card__body", "data-name": "Content" }, ...body) : null,
      footer.length ? h("div", { class: "card__footer t-label", "data-name": "Footer" }, ...footer) : null));
  });

  // <ui-module-tile icon="dumbbell" label="Sport" tone="secondary" value="…" detail="…" meta="…" link="Voir sport">
  define("ui-module-tile", (el) => {
    const tone = attr(el, "tone");
    el.append(h("a", { href: "#", class: "module-tile", "data-name": "ModuleTile" },
      h("div", { class: "module-tile__head" },
        h("span", { class: `module-tile__icon${tone ? ` tone-${tone}` : ""}`, "data-name": "Icon" }, icon(attr(el, "icon", "info"), "md")),
        h("span", { class: "t-micro", "data-name": "Label" }, attr(el, "label", "")),
        el.hasAttribute("badge") ? h("span", { class: `module-tile__badge t-label tone-${tone || "primary"}`, "data-name": "Badge" }, el.getAttribute("badge")) : null,
        h("span", { class: "module-tile__chevron" }, icon("arrow-right", "sm"))),
      h("div", { class: `module-tile__value${el.hasAttribute("value-tone") ? ` tone-${el.getAttribute("value-tone")}` : ""}`, "data-name": "Value" }, attr(el, "value", "")),
      el.hasAttribute("detail") ? h("div", { class: "module-tile__detail t-body-dense", "data-name": "Detail" }, el.getAttribute("detail")) : null,
      h("div", { class: "module-tile__foot t-label", "data-name": "Footer" },
        h("span", {}, attr(el, "meta", "")),
        el.hasAttribute("link") ? h("span", { class: "c-primary" }, el.getAttribute("link")) : null)));
  });

  // <ui-kpi label="…" icon="…" value="38,4" unit="km" progress="75" tone="secondary">meta</ui-kpi>
  define("ui-kpi", (el) => {
    const tone = attr(el, "tone");
    const meta = rest(el);
    const progress = attr(el, "progress");
    el.append(h("div", { class: "kpi", "data-name": "Kpi" },
      h("div", { class: "kpi__head" },
        h("span", { class: "t-micro", "data-name": "Label" }, attr(el, "label", "")),
        el.hasAttribute("icon") ? h("span", { class: tone ? `tone-${tone}` : "" }, icon(el.getAttribute("icon"), "sm")) : null),
      h("div", { class: "kpi__value" },
        h("span", { class: "t-metric", "data-name": "Value" }, attr(el, "value", "")),
        el.hasAttribute("unit") ? h("span", { class: "kpi__unit t-body-dense", "data-name": "Unit" }, el.getAttribute("unit")) : null),
      meta.length ? h("div", { class: "kpi__meta t-label", "data-name": "Meta" }, ...meta) : null,
      progress !== null ? h("div", { class: "kpi__track", role: "progressbar", "aria-valuenow": progress, "aria-valuemin": "0", "aria-valuemax": "100", "data-name": "Progress" },
        h("div", { class: `kpi__fill${tone ? ` tone-${tone}` : ""}`, style: `width: ${Number(progress)}%` })) : null));
  });

  // <ui-week-strip><ui-day label="Sam" date="31" marks="tertiary secondary" today></ui-day>…</ui-week-strip>
  define("ui-week-strip", (el) => {
    el.append(h("div", { class: "week-strip", "data-name": "WeekStrip" }, ...rest(el)));
  });
  define("ui-day", (el) => {
    const marks = (attr(el, "marks", "") || "").split(" ").filter(Boolean);
    el.append(h("div", { class: `day${el.hasAttribute("today") ? " day--today" : ""}`, "data-name": el.hasAttribute("today") ? "Day/Today" : "Day/Default" },
      h("span", { class: "day__label t-micro", "data-name": "Label" }, attr(el, "label", "")),
      h("span", { class: "day__date", "data-name": "Date" }, attr(el, "date", "")),
      h("span", { class: "day__marks", "data-name": "Marks" }, ...marks.map((m) => h("span", { class: `day__mark tone-${m}` })))));
  });

  // <ui-agenda-item icon="calendar" time="09:30" title="Dentiste" kind="Événement" tone="primary" meta="…" trailing="J-1">
  define("ui-agenda-item", (el) => {
    const tone = attr(el, "tone", "primary");
    el.append(h("a", { href: "#", class: "agenda-item", "data-name": "AgendaItem" },
      h("span", { class: `agenda-item__icon${tone === "tertiary" ? " tone-tertiary" : ""}`, "data-name": "Icon" }, icon(attr(el, "icon", "calendar"), "md")),
      h("span", { class: `agenda-item__bar tone-${tone}` }),
      h("span", { class: "agenda-item__text" },
        h("span", { class: "agenda-item__line" },
          h("span", { class: `agenda-item__time tone-${tone}`, "data-name": "Time" }, attr(el, "time", "")),
          h("span", { class: "t-title-sm", "data-name": "Title" }, attr(el, "title", "")),
          el.hasAttribute("kind") ? h("ui-badge", { tone: tone === "secondary" ? "success" : tone === "tertiary" ? "warning" : "info" }, el.getAttribute("kind")) : null),
        h("span", { class: "agenda-item__meta t-body-dense", "data-name": "Meta" }, attr(el, "meta", ""))),
      el.hasAttribute("trailing") ? h("span", { class: "agenda-item__trailing t-label", "data-name": "Trailing" }, el.getAttribute("trailing")) : icon("arrow-right", "md")));
  });

  // <ui-task-card tone="tertiary" pillar="Repas & Planning" space="Espace Foyer" status="En attente" status-tone="warning" title="…" foot="…" action="…">text</ui-task-card>
  define("ui-task-card", (el) => {
    const tone = attr(el, "tone", "primary");
    const text = rest(el);
    const pillarTone = { primary: "primary", secondary: "secondary", tertiary: "tertiary", error: "error" }[tone];
    el.append(h("article", { class: `task-card tone-${tone}`, "data-name": "TaskCard" },
      h("div", { class: "task-card__head t-label" },
        h("ui-tag", { tone: pillarTone }, attr(el, "pillar", "")),
        el.hasAttribute("space") ? h("span", { class: "c-muted" }, el.getAttribute("space")) : null,
        el.hasAttribute("status") ? h("ui-badge", { tone: attr(el, "status-tone", "info") }, el.getAttribute("status")) : null),
      h("h3", { class: "t-title-sm", "data-name": "Title" }, attr(el, "title", "")),
      text.length ? h("p", { class: "task-card__text t-body-dense", "data-name": "Text" }, ...text) : null,
      h("div", { class: "task-card__foot t-label" },
        h("span", { class: `tone-${tone}`, "data-name": "Foot" }, attr(el, "foot", "")),
        el.hasAttribute("action") ? h("a", { href: "#", "data-name": "Action" }, el.getAttribute("action"), icon("arrow-right", "sm")) : null)));
  });

  // <ui-metric label="Distance" value="11,2 km" delta="+1,2 km" delta-tone="secondary" sub="Prévu : 10,0 km">
  define("ui-metric", (el) => {
    el.append(h("div", { class: "metric", "data-name": "Metric" },
      h("span", { class: "metric__label t-label", "data-name": "Label" }, attr(el, "label", "")),
      h("span", { class: `metric__value${el.hasAttribute("tone") ? ` tone-${el.getAttribute("tone")}` : ""}`, "data-name": "Value" }, attr(el, "value", ""),
        el.hasAttribute("delta") ? h("span", { class: `metric__delta tone-${attr(el, "delta-tone", "secondary")}`, "data-name": "Delta" }, el.getAttribute("delta")) : null),
      el.hasAttribute("sub") ? h("span", { class: `metric__sub t-label${el.hasAttribute("sub-tone") ? ` tone-${el.getAttribute("sub-tone")}` : ""}`, "data-name": "Sub" }, el.getAttribute("sub")) : null));
  });

  // <ui-session-card weekday="Mar" day="27" title="…" state="done|missed|planned" cols="4">
  //   <x slot="badges">…</x> <x slot="aside">…</x> <ui-metric>… <x slot="notes">…</x> </ui-session-card>
  define("ui-session-card", (el) => {
    const state = attr(el, "state", "done");
    const badges = take(el, "badges");
    const aside = take(el, "aside");
    const notes = take(el, "notes");
    const metrics = rest(el).filter((n) => n.nodeType === 1);
    el.append(h("article", { class: `session-card session-card--${state}`, "data-name": `SessionCard/${pascal(state)}` },
      h("div", { class: "session-card__head" },
        h("div", { class: "session-card__day", "data-name": "Day" }, h("span", { class: "t-micro" }, attr(el, "weekday", "")), h("strong", {}, attr(el, "day", ""))),
        h("div", { class: "session-card__main" },
          badges.length ? h("div", { class: "session-card__badges t-label", "data-name": "Badges" }, ...badges) : null,
          h("h3", { class: "t-title-sm", "data-name": "Title" }, attr(el, "title", ""))),
        aside.length ? h("div", { class: "session-card__aside t-label", "data-name": "Aside" }, ...aside) : null),
      metrics.length ? h("div", { class: "session-card__metrics", style: `--cols: ${Number(attr(el, "cols", "4"))}`, "data-name": "Metrics" }, ...metrics) : null,
      notes.length ? h("p", { class: "session-card__notes t-body-dense", "data-name": "Notes" }, icon("notes", "sm"), h("span", {}, ...notes)) : null));
  });

  // <ui-empty-state icon="dumbbell" title="…" tone="error">text<x slot="actions">…</x></ui-empty-state>
  define("ui-empty-state", (el) => {
    const actions = take(el, "actions");
    const tone = attr(el, "tone");
    el.append(h("section", { class: `empty-state${tone === "error" ? " empty-state--error" : ""}`, "data-name": tone === "error" ? "ErrorState" : "EmptyState" },
      h("span", { class: "empty-state__icon", "data-name": "Icon" }, icon(attr(el, "icon", "info"), "hero")),
      h("h2", { class: "empty-state__title t-title-sm", "data-name": "Title" }, attr(el, "title", "")),
      h("p", { class: "empty-state__text t-body-dense", "data-name": "Text" }, ...rest(el)),
      actions.length ? h("div", { class: "empty-state__actions", "data-name": "Actions" }, ...actions) : null));
  });

  // <ui-recipe-card title="…" time="35m" selected> <x slot="badge"> <x slot="meta"> <x slot="trailing"> <x slot="footer"> </ui-recipe-card>
  define("ui-recipe-card", (el) => {
    const badge = take(el, "badge");
    const meta = take(el, "meta");
    const trailing = take(el, "trailing");
    const footer = take(el, "footer");
    el.append(h("a", { href: "#", class: "recipe-card", "aria-selected": el.hasAttribute("selected") ? "true" : "false", "data-name": "RecipeCard" },
      h("span", { class: "recipe-card__thumb", "data-name": "Thumbnail" }, icon("utensils", "xl"),
        el.hasAttribute("time") ? h("span", { class: "recipe-card__time t-label" }, el.getAttribute("time")) : null),
      h("span", { class: "recipe-card__body" },
        h("span", { class: "recipe-card__top" }, h("span", {}, ...badge), ...trailing),
        h("span", { class: "t-title-sm", "data-name": "Title" }, attr(el, "title", "")),
        meta.length ? h("span", { class: "recipe-card__meta t-label", "data-name": "Meta" }, ...meta) : null,
        footer.length ? h("span", { class: "recipe-card__foot t-label", "data-name": "Footer" }, ...footer) : null)));
  });

  // <ui-ingredient-row qty="600" unit="g" name="…" product="…" status="En stock (850g)" tone="success">
  define("ui-ingredient-row", (el) => {
    el.append(h("div", { class: "ingredient-row", role: "row", "data-name": "IngredientRow" },
      h("span", { class: "ingredient-row__qty", role: "cell", "data-name": "Quantity" }, attr(el, "qty", ""), " ", h("span", {}, attr(el, "unit", ""))),
      h("span", { class: "ingredient-row__name t-body", role: "cell", "data-name": "Name" }, attr(el, "name", "")),
      h("span", { class: "ingredient-row__product t-label", "data-name": "Product" }, attr(el, "product", "")),
      h("span", { class: "ingredient-row__status", role: "cell", "data-name": "Status" }, h("ui-badge", { tone: attr(el, "tone", "success"), dot: true }, attr(el, "status", "")))));
  });

  // <ui-step n="1" title="…" duration="10 min">text</ui-step>
  define("ui-step", (el) => {
    el.append(h("div", { class: "step", "data-name": "Step" },
      h("span", { class: "step__n", "data-name": "Number" }, attr(el, "n", "")),
      h("div", { class: "step__head" },
        h("h3", { class: "t-title-sm", "data-name": "Title" }, attr(el, "title", "")),
        el.hasAttribute("duration") ? h("ui-badge", { tone: "warning", icon: "timer" }, el.getAttribute("duration")) : null),
      h("p", { class: "step__text t-body", "data-name": "Text" }, ...rest(el))));
  });

  // <ui-stepper value="4" label="Portions">
  define("ui-stepper", (el) => {
    const label = attr(el, "label", "Quantité");
    el.append(h("div", { class: "stepper", role: "group", "aria-label": label, "data-name": "Stepper" },
      h("button", { type: "button", class: "stepper__btn", "aria-label": `Retirer une unité : ${label}` }, icon("minus", "sm")),
      h("span", { class: "stepper__value t-metric", "data-name": "Value" }, attr(el, "value", "")),
      h("button", { type: "button", class: "stepper__btn", "aria-label": `Ajouter une unité : ${label}` }, icon("plus", "sm"))));
  });

  // <ui-input label="…" value="…" placeholder="…" state="error" icon="alert">
  define("ui-input", (el) => {
    const state = attr(el, "state");
    const value = attr(el, "value");
    el.append(h("label", { class: "field", "data-name": state === "error" ? "Input/Error" : "Input/Default" },
      el.hasAttribute("label") ? h("span", { class: "field__label t-micro", "data-name": "Label" }, el.getAttribute("label")) : null,
      h("span", { class: `input t-body${state === "error" ? " input--error" : ""}` },
        h("span", { class: value ? "" : "c-muted", "data-name": "Value" }, value || attr(el, "placeholder", "")),
        el.hasAttribute("icon") ? h("ui-icon", { name: el.getAttribute("icon"), class: state === "error" ? "tone-tertiary" : "c-muted" }) : null)));
  });

  // <ui-callout tone="warning|success" icon="help" title="…">body</ui-callout>
  define("ui-callout", (el) => {
    const tone = attr(el, "tone");
    el.append(h("div", { class: `callout${tone ? ` callout--${tone}` : ""}`, role: tone === "warning" ? "alert" : null, "data-name": `Callout/${pascal(tone || "neutral")}` },
      el.hasAttribute("title") ? h("p", { class: "callout__title t-title-sm", "data-name": "Title" }, el.hasAttribute("icon") ? icon(el.getAttribute("icon"), "lg") : null, el.getAttribute("title")) : null,
      ...rest(el)));
  });

  // <ui-choice hint="[Conserve]">+ Tomate en conserve</ui-choice>
  define("ui-choice", (el) => {
    el.append(h("button", { type: "button", class: "choice t-body", "data-name": "Choice" }, icon("check", "sm"),
      h("span", { "data-name": "Label" }, ...rest(el)),
      el.hasAttribute("hint") ? h("span", { class: "t-mono c-muted" }, el.getAttribute("hint")) : null));
  });

  // ---------- App shell ----------
  const NAV = [
    ["Organisation", [["accueil", "Accueil", "home"], ["agenda", "Agenda", "list"], ["calendrier", "Calendrier", "calendar"], ["sport", "Sport", "dumbbell"]]],
    ["Cuisine & nutrition", [["repas", "Planning des repas", "utensils"], ["recettes", "Recettes", "book"], ["stock", "Stock", "archive"], ["courses", "Courses", "cart"]]],
    ["Gestion", [["finances", "Finances", "wallet", true], ["documents", "Documents", "folder", true], ["immobilier", "Immobilier", "building", true]]],
    ["Professionnel", [["projets", "Projets", "rocket"], ["portfolio", "Portfolio", "briefcase"], ["documentation", "Documentation", "file", true]]],
    ["Système", [["sauvegardes", "Sauvegardes", "backup"], ["integrations", "Intégrations", "hub", true], ["parametres", "Paramètres", "settings"]]],
  ];
  const TABS = [["accueil", "Accueil", "grid"], ["agenda", "Agenda", "calendar"], ["sport", "Sport", "dumbbell"], ["repas", "Repas", "utensils"], ["plus", "Plus", "more"]];
  const TAB_OF = { recettes: "repas", stock: "repas", courses: "repas", calendrier: "agenda" };

  // <ui-app-shell active="sport" space="personnel|foyer">page content</ui-app-shell>
  define("ui-app-shell", (el) => {
    const active = attr(el, "active", "accueil");
    const foyer = attr(el, "space") === "foyer";
    const content = rest(el);
    const tab = TAB_OF[active] || (TABS.some(([k]) => k === active) ? active : "plus");
    el.append(h("div", { class: "shell", "data-name": "AppShell" },
      h("header", { class: "topbar", "data-name": "TopBar" },
        h("span", { class: "topbar__menu" }, h("ui-icon-button", { icon: "menu", label: "Menu" })),
        h("div", { class: "topbar__brand", "data-name": "Brand" },
          h("span", { class: "topbar__logo", "data-name": "Logo" }, icon("server", "md")),
          h("span", { class: "topbar__name" }, h("strong", {}, "DCCM"), h("span", { class: "t-micro" }, "Personal OS"))),
        h("ui-segmented", { label: "Espace" },
          h("ui-segment", { pressed: !foyer }, "Mon espace"),
          h("ui-segment", { pressed: foyer }, "Foyer")),
        h("div", { class: "topbar__search", "data-name": "CommandSearch" }, h("ui-search", { placeholder: "Que veux-tu faire ?", shortcut: "⌘K", icon: "terminal" })),
        h("div", { class: "topbar__end" },
          h("span", { class: "mobile-only" }, h("ui-icon-button", { icon: "search", label: "Que veux-tu faire ?" })),
          h("span", { class: "desktop-only" }, h("ui-icon-button", { icon: "moon", label: "Thème sombre" })),
          h("div", { class: "topbar__user", "data-name": "UserBlock" },
            h("span", { class: "avatar", "data-name": "Avatar" }, icon("user", "md")),
            h("span", { class: "topbar__user-text" }, h("strong", {}, "Maxime"), h("span", { class: "t-label" }, "Propriétaire")),
            h("a", { href: "#", class: "topbar__logout t-label" }, icon("logout", "sm"), "Déconnexion")))),
      h("nav", { class: "sidebar", "aria-label": "Navigation principale", "data-name": "Sidebar" },
        ...NAV.map(([group, items]) => h("div", { class: "sidebar__group", "data-name": `Sidebar / ${group}` },
          h("p", { class: "sidebar__heading t-micro" }, group),
          ...items.map(([key, label, ic, soon]) => h("a", { href: "#", class: "sidebar__item", "aria-current": key === active ? "page" : null, "data-name": "Sidebar/Item" },
            icon(ic, "md"), h("span", {}, label), soon ? h("ui-badge", { tone: "warning" }, "À venir") : null)))),
        h("div", { class: "sidebar__footer" },
          h("a", { href: "#", class: "sidebar__item" }, icon("help", "md"), h("span", {}, "Aide et support")),
          h("div", { class: "sidebar__node t-label", "data-name": "NodeStatus" }, h("ui-badge", { tone: "success", dot: true }, "Nœud DCCM actif"), h("span", { class: "t-mono" }, "v4.8")))),
      h("main", { class: "shell__main", "data-name": "Content" }, ...content),
      h("nav", { class: "tabbar", "aria-label": "Navigation mobile", "data-name": "TabBar" },
        ...TABS.map(([key, label, ic]) => h("a", { href: "#", class: "tabbar__item", "aria-current": key === tab ? "page" : null, "data-name": "TabBar/Item" }, icon(ic, "xl"), h("span", {}, label))))));
  });
})();
