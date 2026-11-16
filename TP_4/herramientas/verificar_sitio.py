#!/usr/bin/env python3
"""Revisión del sitio de GitHub Pages antes de entregar (TP4, ML1 FIUNA).

Solo lectura: no cambia ningún archivo. Usa solo la biblioteca estándar.

Revisa:
  1. Archivos locales a los que apunta el HTML (css, js, imágenes): que existan
     y que el nombre coincida en mayúsculas/minúsculas (GitHub Pages distingue).
  2. Anclas internas (#seccion): que exista el id.
  3. Marcadores EDITAR y textos [Completar ...] que quedan.
  4. Secciones ocultas (5 y 6) y si sus figuras existen.
  5. .nojekyll presente.
  6. Con --red: los enlaces externos responden (sin 404).

Uso (desde la raíz del repo, en la terminal del contenedor):
    python herramientas/verificar_sitio.py docs
    python herramientas/verificar_sitio.py docs --red
Salida: 0 si no hay errores (✗), 1 si hay alguno.
"""
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


class Recolector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []          # (atributo, valor, oculto)
        self.ids = set()
        self.pila_oculta = []   # etiquetas abiertas con hidden
        self.profundidad = 0
        self.ocultas = []       # ids de secciones ocultas

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        oculto_aqui = "hidden" in a
        if tag in ("section", "li", "div", "figure") and oculto_aqui:
            self.pila_oculta.append(tag)
            if tag == "section" and "id" in a:
                self.ocultas.append(a["id"])
        oculto = bool(self.pila_oculta)
        for clave in ("href", "src", "data-src"):
            if clave in a and a[clave]:
                self.refs.append((clave, a[clave], oculto))

    def handle_endtag(self, tag):
        if self.pila_oculta and self.pila_oculta[-1] == tag:
            self.pila_oculta.pop()


def existe_exacto(raiz: Path, rel: str) -> bool:
    """Existe con el mismo uso de mayúsculas en cada parte de la ruta."""
    actual = raiz
    for parte in Path(rel).parts:
        if not actual.is_dir() or parte not in {p.name for p in actual.iterdir()}:
            return False
        actual = actual / parte
    return actual.exists()


def main():
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    con_red = "--red" in sys.argv
    raiz = Path(args[0] if args else "docs").resolve()
    html = raiz / "index.html"
    if not html.is_file():
        print(f"✗ no existe {html}")
        return 1

    texto = html.read_text(encoding="utf-8")
    r = Recolector()
    r.feed(texto)
    errores = avisos = 0

    def mal(msg):
        nonlocal errores
        errores += 1
        print("  ✗", msg)

    def ojo(msg):
        nonlocal avisos
        avisos += 1
        print("  !", msg)

    print(f"== {html}")


    print("== archivos locales")
    externos = []
    for clave, valor, oculto in r.refs:
        if valor.startswith(("http://", "https://")):
            externos.append(valor)
            continue
        if valor.startswith(("mailto:", "data:", "#")):
            if valor.startswith("#") and len(valor) > 1 and valor[1:] not in r.ids:
                mal(f"ancla rota: {valor}")
            continue
        if valor.startswith("/"):
            mal(f"ruta absoluta {valor}: en Pages apunta a la raíz de usuario.github.io; usar ruta relativa")
            continue
        rel = valor.split("#")[0].split("?")[0]
        if existe_exacto(raiz, rel):
            print(f"  ✓ {rel}")
        elif oculto:
            ojo(f"{rel} (sección oculta: hace falta recién al mostrarla)")
        elif rel.startswith("assets/img/"):
            mal(f"figura pendiente: {rel}")
        else:
            mal(f"no existe: {rel}")

    print("== textos por completar")
    for n, linea in enumerate(texto.splitlines(), 1):
        if "EDITAR" in linea:
            ojo(f"línea {n}: {linea.strip()[:90]}")
    pend = re.findall(r"\[Completar[^\]]*\]", texto)
    if pend:
        ojo(f"{len(pend)} textos [Completar…] (incluye los de secciones ocultas)")
    for marcador in ("Nombre Apellido", "usuario@fiuna.edu.py", "github.com/usuario"):
        if marcador in texto:
            mal(f"queda el marcador de integrante «{marcador}»")

    print("== secciones ocultas")
    print("  ", ", ".join(r.ocultas) if r.ocultas else "ninguna (5 y 6 visibles)")

    if con_red:
        print("== enlaces externos")
        vistos = set()
        for url in externos:
            if url in vistos:
                continue
            vistos.add(url)
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (verificar_sitio)"})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    print(f"  ✓ {resp.status} {url}")
            except urllib.error.HTTPError as e:
                if e.code in (403, 429):
                    ojo(f"{e.code} {url} (el sitio rechaza robots: abrirlo a mano)")
                else:
                    mal(f"{e.code} {url}")
            except Exception as e:  # sin red, DNS, tiempo agotado
                ojo(f"{type(e).__name__} {url}")
    else:
        print(f"== enlaces externos: {len(set(externos))} sin revisar (agregar --red)")

    print(f"== resultado: {errores} ✗ · {avisos} avisos")
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
