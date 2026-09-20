"""
Tests for Progressive Web App (PWA) configuration and assets.
Ensures Chrome on Android and desktop recognize Slide-Printer as installable.
"""

import json
import os
import re
from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(REPO_ROOT, 'web')


def test_manifest_structure_and_icons():
    manifest_path = os.path.join(WEB_DIR, 'manifest.json')
    assert os.path.exists(manifest_path), 'web/manifest.json is missing'

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    assert manifest.get('name') == 'Slide-Printer — PDF Handout Generator'
    assert manifest.get('short_name') == 'Slide-Printer'
    assert manifest.get('start_url') in ['./', './index.html']
    assert manifest.get('scope') == './'
    assert manifest.get('id') == './'
    assert manifest.get('display') == 'standalone'
    assert manifest.get('theme_color') == '#141517'
    assert manifest.get('background_color') == '#141517'

    icons = manifest.get('icons', [])
    assert len(icons) >= 4, 'Manifest must declare standard and maskable icons'

    sizes_found = {}
    for icon in icons:
        rel_src = icon['src']
        abs_src = os.path.join(WEB_DIR, rel_src)
        assert os.path.exists(abs_src), f'Icon file does not exist: {abs_src}'

        if rel_src.endswith('.png'):
            with Image.open(abs_src) as img:
                expected_size = icon['sizes']
                actual_size = f'{img.width}x{img.height}'
                assert actual_size == expected_size, f'Dimension mismatch for {rel_src}: expected {expected_size}, got {actual_size}'
                sizes_found[expected_size] = sizes_found.get(expected_size, 0) + 1

    assert '192x192' in sizes_found, '192x192 PNG icon is required by Chrome'
    assert '512x512' in sizes_found, '512x512 PNG icon is required by Chrome'
    assert any(i.get('purpose') == 'maskable' for i in icons), 'Maskable icon is required for Android adaptive icons'


def test_service_worker_structure_and_precached_assets():
    sw_path = os.path.join(WEB_DIR, 'sw.js')
    assert os.path.exists(sw_path), 'web/sw.js is missing'

    with open(sw_path, 'r', encoding='utf-8') as f:
        sw_content = f.read()

    assert "addEventListener('install'" in sw_content
    assert "addEventListener('activate'" in sw_content
    assert "addEventListener('fetch'" in sw_content

    # Extract PRECACHE_ASSETS
    match = re.search(r'const PRECACHE_ASSETS = \[(.*?)\];', sw_content, re.DOTALL)
    assert match, 'PRECACHE_ASSETS definition missing in sw.js'

    raw_items = match.group(1).split(',')
    clean_items = [item.strip().strip("'").strip('"') for item in raw_items if item.strip().strip("'").strip('"')]

    assert len(clean_items) >= 10, 'Precache list should cover all essential app files'

    for item in clean_items:
        if item in ['./', './index.html']:
            target = os.path.join(WEB_DIR, 'index.html')
        else:
            rel = item.lstrip('./')
            target = os.path.join(WEB_DIR, rel)
        assert os.path.exists(target), f'Precached asset not found on disk: {target}'


def test_html_pwa_integration():
    index_path = os.path.join(WEB_DIR, 'index.html')
    with open(index_path, 'r', encoding='utf-8') as f:
        html = f.read()

    assert 'rel="manifest" href="manifest.json"' in html
    assert 'name="theme-color"' in html
    assert 'name="mobile-web-app-capable" content="yes"' in html
    assert 'name="apple-mobile-web-app-capable" content="yes"' in html
    assert 'apple-touch-icon' in html
    assert 'id="installAppBtn"' in html


def test_app_js_pwa_registration():
    app_js_path = os.path.join(WEB_DIR, 'js', 'app.js')
    with open(app_js_path, 'r', encoding='utf-8') as f:
        js = f.read()

    assert 'setupPWA()' in js
    assert 'navigator.serviceWorker.register' in js
    assert 'beforeinstallprompt' in js
    assert 'appinstalled' in js
    assert 'installApp:' in js
    assert 'installAppTitle:' in js
