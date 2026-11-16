/* =============================================================
   main.js — comportamiento del sitio (sin librerías externas)
   1. Marca en la barra la sección visible.
   2. Figuras pendientes: si una imagen de assets/img todavía no
      existe, muestra un recuadro con el nombre esperado.
   3. Gráfico de barras accesible a partir de un bloque JSON.
   ============================================================= */
(function () {
  "use strict";

  /* ---------- 1. Sección activa en la barra ---------- */
  function seccionActiva() {
    var enlaces = Array.prototype.slice.call(document.querySelectorAll(".barra__enlaces a[href^='#']"));
    if (!("IntersectionObserver" in window) || enlaces.length === 0) return;
    var porId = {};
    enlaces.forEach(function (a) { porId[a.getAttribute("href").slice(1)] = a; });
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        enlaces.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = porId[e.target.id];
        if (a) {
          a.setAttribute("aria-current", "true");
          // en el celular, que el enlace activo quede a la vista en la tira
          if (a.scrollIntoView && window.innerWidth < 760) {
            a.scrollIntoView({ block: "nearest", inline: "center" });
          }
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(porId).forEach(function (id) {
      var s = document.getElementById(id);
      if (s && !s.hidden) obs.observe(s);
    });
  }

  /* ---------- 2. Figuras pendientes ---------- */
  function marcarPendiente(img) {
    if (img.dataset.marcada) return;
    img.dataset.marcada = "1";
    var caja = document.createElement("div");
    caja.className = "fig-pendiente";
    caja.setAttribute("role", "img");
    caja.setAttribute("aria-label", "Figura pendiente: " + (img.getAttribute("alt") || ""));
    var t = document.createElement("strong");
    t.textContent = "Figura pendiente";
    var r = document.createElement("span");
    r.innerHTML = "Guardar como <code>" + (img.dataset.src || img.getAttribute("src")) + "</code>";
    caja.appendChild(t);
    caja.appendChild(r);
    if (img.dataset.origen) {
      var o = document.createElement("span");
      o.textContent = "Se genera en: " + img.dataset.origen;
      caja.appendChild(o);
    }
    img.replaceWith(caja);
  }

  function figurasPendientes() {
    // Las imágenes de secciones ocultas (5 y 6) usan data-src: se piden
    // solo cuando la sección se muestra, así no generan 404 mientras tanto.
    document.querySelectorAll("img[data-src]").forEach(function (img) {
      if (!img.closest("[hidden]")) img.setAttribute("src", img.dataset.src);
    });
    document.querySelectorAll("img[data-origen][src]").forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) marcarPendiente(img);
      img.addEventListener("error", function () { marcarPendiente(img); });
    });
  }

  /* ---------- 3. Gráfico de barras horizontal ---------- */
  function graficoBarras(contenedor) {
    var fuente = document.getElementById(contenedor.dataset.datos);
    if (!fuente) return;
    var datos;
    try { datos = JSON.parse(fuente.textContent); } catch (e) { return; }
    var unidad = contenedor.dataset.unidad || "";
    var total = datos.reduce(function (s, d) { return s + d.valor; }, 0);
    var max = Math.max.apply(null, datos.map(function (d) { return d.valor; }));

    var NS = "http://www.w3.org/2000/svg";
    // El SVG se dibuja al ancho real del contenedor (sin escalar), así el
    // texto queda siempre en 13 px, tanto en el celular como en la PC.
    var interno = contenedor.clientWidth - 32;
    var ancho = Math.max(280, Math.min(interno, 760));
    var izq = 110, der = 100, alto = 26, sep = 10, arriba = 4;
    var h = arriba + datos.length * (alto + sep);
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + ancho + " " + h);
    svg.setAttribute("width", ancho);
    svg.setAttribute("height", h);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", contenedor.dataset.titulo || "Gráfico de barras");

    var eje = document.createElementNS(NS, "line");
    eje.setAttribute("x1", izq); eje.setAttribute("x2", izq);
    eje.setAttribute("y1", 0); eje.setAttribute("y2", h - sep + 2);
    eje.setAttribute("class", "eje");

    var tip = document.createElement("div");
    tip.className = "tooltip";
    contenedor.appendChild(tip);

    function mostrar(d, barra, ev) {
      var pct = (100 * d.valor / total).toFixed(1).replace(".", ",");
      tip.innerHTML = "<strong>" + d.etiqueta + "</strong><br>" +
        d.valor.toLocaleString("es-PY") + " " + unidad + " · " + pct + " %" +
        (d.detalle ? "<br>" + d.detalle : "");
      var caja = contenedor.getBoundingClientRect();
      var b = barra.getBoundingClientRect();
      var x = ev && ev.clientX ? ev.clientX - caja.left : b.left - caja.left + b.width / 2;
      tip.style.left = Math.min(Math.max(x, 90), caja.width - 90) + "px";
      tip.style.top = (b.top - caja.top) + "px";
      tip.classList.add("visible");
      barra.classList.add("activa");
    }
    function ocultar(barra) { tip.classList.remove("visible"); barra.classList.remove("activa"); }

    datos.forEach(function (d, i) {
      var y = arriba + i * (alto + sep);
      var w = Math.max(2, (ancho - izq - der) * d.valor / max);

      var rot = document.createElementNS(NS, "text");
      rot.setAttribute("x", izq - 10); rot.setAttribute("y", y + alto / 2 + 4.5);
      rot.setAttribute("text-anchor", "end"); rot.setAttribute("class", "rotulo");
      rot.textContent = d.etiqueta;

      // barra: extremo de datos redondeado (4 px), anclada al eje
      var r = 4;
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d",
        "M" + izq + "," + y + " h" + (w - r) + " a" + r + "," + r + " 0 0 1 " + r + "," + r +
        " v" + (alto - 2 * r) + " a" + r + "," + r + " 0 0 1 -" + r + "," + r + " h-" + (w - r) + " z");
      p.setAttribute("class", "barra-dato");

      var val = document.createElementNS(NS, "text");
      val.setAttribute("x", izq + w + 8); val.setAttribute("y", y + alto / 2 + 4.5);
      val.setAttribute("class", "valor");
      val.textContent = d.valor.toLocaleString("es-PY") + " " + unidad;

      // zona de contacto más grande que la barra (toda la fila)
      var zona = document.createElementNS(NS, "rect");
      zona.setAttribute("x", 0); zona.setAttribute("y", y - sep / 2);
      zona.setAttribute("width", ancho); zona.setAttribute("height", alto + sep);
      zona.setAttribute("class", "zona");
      zona.setAttribute("tabindex", "0");
      zona.setAttribute("aria-label", d.etiqueta + ": " + d.valor + " " + unidad);
      zona.addEventListener("mousemove", function (ev) { mostrar(d, p, ev); });
      zona.addEventListener("mouseleave", function () { ocultar(p); });
      zona.addEventListener("focus", function () { mostrar(d, p); });
      zona.addEventListener("blur", function () { ocultar(p); });

      svg.appendChild(p); svg.appendChild(rot); svg.appendChild(val); svg.appendChild(zona);
    });
    svg.appendChild(eje);
    contenedor.insertBefore(svg, tip);
  }

  document.addEventListener("DOMContentLoaded", function () {
    seccionActiva();
    figurasPendientes();
    var graficos = document.querySelectorAll(".grafico[data-datos]");
    function dibujar() {
      graficos.forEach(function (g) { g.innerHTML = ""; graficoBarras(g); });
    }
    dibujar();
    var ultimoAncho = window.innerWidth, espera;
    window.addEventListener("resize", function () {
      if (window.innerWidth === ultimoAncho) return;   // el celular dispara resize al hacer scroll
      ultimoAncho = window.innerWidth;
      clearTimeout(espera); espera = setTimeout(dibujar, 150);
    });
    var anio = document.getElementById("anio");
    if (anio) anio.textContent = new Date().getFullYear();
  });
})();
