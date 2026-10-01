/* =========================================================================
   MÀN HÌNH GOOGLE — Maps JavaScript API + Places UI Kit.

   Places UI Kit là bộ thành phần web dựng sẵn của Google: bạn đặt một thẻ
   <gmp-place-details place="ChIJ..."> lên trang, và Google tự vẽ ảnh, giờ mở
   cửa, đánh giá, review, tóm tắt — không phải tự dựng gì.

   BA ĐIỀU CẦN BIẾT:

   1. NẠP THEO YÊU CẦU. Script Google chỉ tải khi người dùng mở đúng màn hình
      này. Ba bề mặt còn lại — bản đồ OSM, danh sách, tổng quan — vẫn chạy
      ngoại tuyến và không gọi ra ngoài. Kiểm thử H-2 vẫn có hiệu lực cho
      màn hình mặc định.

   2. NỘI DUNG GOOGLE NẰM TRÊN BẢN ĐỒ GOOGLE. Đây là <gmp-map> của chính
      Google, không phải MapLibre. Bản đồ OSM ở màn hình kia vẫn tuyệt đối
      không có dữ liệu Google.

   3. TÍNH TIỀN THEO LƯỢT. Mỗi lần mở màn hình này là một lượt gọi Places.
      Vì vậy nó không tự nạp, và nó nhớ dữ liệu đã tải để không gọi lại.

   Đầu vào có sẵn: payload đã chứa 158 Place ID thật của Google, nên không
   phải đi tìm — chỉ việc đưa thẳng vào thành phần UI Kit.
   ========================================================================= */

import { esc } from '../components/primitives.js';
import { money, distance } from '../format.js';
import { isPresent } from '../data.js';

let loaderStarted = false;
let khoa3d = '';
let placesLib = null;

/** Bootstrap loader chính thức của Google, nguyên văn từ tài liệu. */
function bootstrap(key) {
  if (loaderStarted) return;
  loaderStarted = true;
  /* eslint-disable */
  ((g) => {
    var h, a, k, p = 'The Google Maps JavaScript API', c = 'google', l = 'importLibrary',
      q = '__ib__', m = document, b = window;
    b = b[c] || (b[c] = {});
    var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
      u = () => h || (h = new Promise(async (f, n) => {
        await (a = m.createElement('script'));
        e.set('libraries', [...r] + '');
        for (k in g) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), g[k]);
        e.set('callback', c + '.maps.' + q);
        a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
        d[q] = f;
        a.onerror = () => h = n(Error(p + ' could not load.'));
        a.nonce = m.querySelector('script[nonce]')?.nonce || '';
        m.head.append(a);
      }));
    d[l] ? console.warn(p + ' only loads once. Ignoring:', g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
  })({ key, v: 'weekly', language: 'vi', region: 'VN' });
  /* eslint-enable */
}

/* ---- Dịch mã lỗi của Google sang việc cần làm -------------------------- */
const CONSOLE_URL = 'https://console.cloud.google.com/apis/library';

function authHelp(title, kind) {
  const rows = {
    // Mã này CHỈ nói về Maps JavaScript API. Places UI Kit có thể đã bật và
    // đã tính tiền request rồi mà vẫn ra lỗi này — vì mọi thành phần UI Kit
    // đều chạy trên lõi Maps JS. Bật đúng một API là xong.
    'ApiNotActivatedMapError': [
      'Khóa hợp lệ nhưng dự án Google Cloud chưa bật Maps JavaScript API. '
      + 'Places UI Kit cần API này để hiển thị.',
      [['Bật Maps JavaScript API', 'maps-backend.googleapis.com']],
    ],
    'RefererNotAllowedMapError': [
      'Địa chỉ trang đang mở chưa nằm trong danh sách HTTP referrer được phép của khóa.',
      null,
    ],
    'BillingNotEnabledMapError': [
      'Dự án Google Cloud chưa bật thanh toán; Maps Platform yêu cầu điều này kể cả trong hạn mức miễn phí.',
      null,
    ],
    auth: ['Google từ chối khóa này.', null],
  };
  const [msg, apis] = rows[kind] || rows.auth;
  return `<b>${esc(title)}</b><br>${msg}<br><br>`
    + (apis
      ? 'Bật trong Google Cloud Console rồi tải lại trang:<ul class="gg__todo">'
        + apis.map(([n, id]) =>
          `<li><a href="${CONSOLE_URL}/${id}" target="_blank" rel="noopener noreferrer">${esc(n)}</a></li>`).join('')
        + '</ul>'
      : 'Sửa trong Google Cloud Console → APIs &amp; Services → Credentials, rồi tải lại trang.')
    + '';
}

/** Google ghi lỗi cấu hình ra console chứ không ném ngoại lệ. */
function hookConsole(show) {
  if (window.__ggHooked) return;
  window.__ggHooked = true;
  const orig = console.error.bind(console);
  console.error = (...args) => {
    const txt = args.map(String).join(' ');
    const m = txt.match(/Google Maps JavaScript API error:\s*(\w+)/);
    if (m) show(authHelp(m[1], m[1]), true);
    orig(...args);
  };
}

/* ---- Khung tĩnh: vẽ ngay, chưa gọi mạng ------------------------------- */
export function googleShell() {
  return `
  <div class="gg">
    <div class="gg__head">
      <div>
        <p class="ov__sectag">Google Maps</p>
        <h3>Tòa nhà trên Google Maps</h3>
        <p class="ov__lede">Ảnh, giờ mở cửa và đánh giá của các địa điểm quanh tòa nhà, cùng mô hình 3D,
          lấy trực tiếp từ Google.</p>
      </div>
      <div class="gg__gate" id="gg-gate">
        <p class="gg__warn">
          Phần này tải dữ liệu từ Google theo từng lượt xem.
        </p>
        <button class="btn btn--primary btn--lg" type="button" id="gg-start">Mở Google Maps</button>
      </div>
    </div>
    <div class="gg__body" id="gg-body" hidden></div>
    <p class="gg__err" id="gg-err" hidden></p>
  </div>`;
}

/* ---- Nạp thật ---------------------------------------------------------- */
export async function startGoogle({ key, mapId, building, onError, shareMode }) {
  khoa3d = key;
  const err = document.getElementById('gg-err');
  const body = document.getElementById('gg-body');
  const gate = document.getElementById('gg-gate');
  // `specific` = đã biết mã lỗi đích danh của Google. Thông báo chung chung
  // (gm_authFailure) không được đè lên nó — mã đích danh mới nói được phải
  // làm gì, còn thông báo chung chỉ nói "bị từ chối".
  const show = (msg, specific = false) => {
    if (!err) return;
    if (err.dataset.specific === '1' && !specific) return;
    if (specific) err.dataset.specific = '1';
    err.hidden = false;
    err.innerHTML = msg;
    onError?.(msg);
  };

  if (!key) {
    show(shareMode
      ? 'Phần Google Maps không có trong bản chia sẻ. Bản đồ, danh sách và tổng quan vẫn dùng đầy đủ.'
      : 'Chưa có khóa Google Maps. Tạo tệp <code>config.khoa.js</code> (git đã bỏ qua tệp này) với dòng '
        + '<code>export const GOOGLE_MAPS_API_KEY = \'...\';</code> rồi tải lại trang.');
    return;
  }

  gate.hidden = true;
  body.hidden = false;
  body.innerHTML = '<p class="gg__loading">Đang nạp Google Maps…</p>';

  // Google KHÔNG ném lỗi cho những trục trặc cấu hình dự án — nó vẽ tấm
  // "Rất tiếc! Đã xảy ra lỗi" của riêng nó rồi ghi một dòng vào console.
  // Hai móc dưới đây bắt lại và nói rõ phải làm gì, thay vì để người dùng
  // đoán.
  window.gm_authFailure = () => show(authHelp('Khóa bị từ chối', 'auth'));
  hookConsole(show);

  try {
    bootstrap(key);
    // Places UI Kit nằm trong thư viện 'places'; <gmp-map> nằm trong 'maps'.
    placesLib = await google.maps.importLibrary('places');
    await google.maps.importLibrary('maps');
    await google.maps.importLibrary('marker');
  } catch (e) {
    body.hidden = true;
    gate.hidden = false;
    show(`Không nạp được Google Maps: <code>${esc(e.message)}</code>.<br>`
      + 'Kiểm tra khóa đã bật Maps JavaScript API và Places UI Kit, và cho phép địa chỉ trang đang mở.');
    return;
  }

  render(body, { mapId, building });
}

function render(body, { mapId, building }) {
  const b = building;
  const places = (b?.amenities || []).flatMap((g) =>
    g.places.map((p) => ({ ...p, group: g.label })));
  const first = places[0];

  body.innerHTML = `
    <div class="gg__grid">
      <div class="gg__mapwrap">
        <gmp-map id="gg-map" map-id="${esc(mapId)}" zoom="16"
          center="${b.lat},${b.lng}" style="height:100%">
          <gmp-advanced-marker id="gg-home" position="${b.lat},${b.lng}"
            title="${esc(b.name)}"></gmp-advanced-marker>
        </gmp-map>
      </div>

      <aside class="gg__side">
        <div class="gg__sidehead">
          <span class="label">Tòa đang xem</span>
          <h4>${esc(b.name)}</h4>
          <p class="gg__sub">${isPresent(b.baseRent)
    ? `giá thuê 03/2026: ${esc(money(b.baseRent.value))}` : 'chưa có giá'}
            ${isPresent(b.distanceMetro) ? `· ga ${esc(b.nearestMetro)} ${esc(distance(b.distanceMetro.value))}` : ''}</p>
        </div>

        <div class="gg__list" id="gg-list" role="listbox" aria-label="Tiện ích Google quanh tòa nhà">
          ${places.map((p, i) => `
            <button class="gg__item ${i === 0 ? 'is-on' : ''}" type="button" role="option"
              aria-selected="${i === 0}" data-pid="${esc(p.placeId)}"
              data-lat="${p.latitude}" data-lng="${p.longitude}">
              <span class="gg__itemname">${esc(p.name)}</span>
              <span class="gg__itemmeta">${esc(p.group)}
                ${p.distanceM != null ? ` · ${esc(distance(p.distanceM))} đường thẳng` : ''}</span>
            </button>`).join('')}
        </div>

        <div class="gg__detail" id="gg-detail">
          ${first ? placeDetailsMarkup(first.placeId) : '<p class="gg__loading">Chưa có danh sách tiện ích Google cho tòa này.</p>'}
        </div>
      </aside>
    </div>

    <section class="gg__3d" aria-label="Tòa nhà 3D">
      <div class="gg__sidehead">
        <span class="label">Tòa nhà 3D</span>
        <h4>Mô hình 3D quanh ${esc(b.name)}</h4>
        <p class="gg__sub">Kéo để xoay, cuộn để phóng. Nguồn: Google Photorealistic 3D Tiles.</p>
      </div>
      <button class="btn" type="button" id="gg-3d-nut">Xem tòa nhà 3D</button>
      <div class="gg__3dview" id="gg-3d" hidden></div>
    </section>
    <p class="gg__note">Nội dung địa điểm và mô hình 3D do Google cung cấp.</p>`;

  wire(body, { building: b });
  body.querySelector('#gg-3d-nut')?.addEventListener('click', (ev) => {
    ev.currentTarget.disabled = true;
    moToa3d(body.querySelector('#gg-3d'), b).catch((e) => {
      const o = body.querySelector('#gg-3d');
      o.hidden = false;
      o.innerHTML = `<p class="gg__loading">Không nạp được mô hình 3D: <code>${esc(e.message)}</code></p>`;
    });
  }, { once: true });
}

/* TÒA NHÀ 3D (30/09, QĐ 189): Photorealistic 3D Tiles của Map Tiles API qua CesiumJS. Chọn đường này vì giá công bố rõ
   (1.000 lượt miễn phí mỗi tháng, 6 USD mỗi 1.000 lượt sau đó); kiểu 3D gắn trong Maps JavaScript chưa ghi giá rõ.
   Nội dung Google trên trình vẽ 3D dành cho nó, Cesium tự hiện ghi công Google. Nạp thư viện từ jsDelivr chỉ khi bấm. */
const CESIUM = 'https://cdn.jsdelivr.net/npm/cesium@1.119.0/Build/Cesium/';
function napCesium() {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  window.CESIUM_BASE_URL = CESIUM;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = CESIUM + 'Widgets/widgets.css';
  document.head.append(css);
  return new Promise((ok, loi) => {
    const s = document.createElement('script');
    s.src = CESIUM + 'Cesium.js';
    s.onload = () => ok(window.Cesium);
    s.onerror = () => loi(new Error('không tải được CesiumJS'));
    document.head.append(s);
  });
}

async function moToa3d(hop, b) {
  if (!khoa3d) throw new Error('chưa có khoá Google');
  hop.hidden = false;
  hop.innerHTML = '<p class="gg__loading">Đang nạp mô hình 3D…</p>';
  const Cesium = await napCesium();
  hop.innerHTML = '';
  Cesium.GoogleMaps.defaultApiKey = khoa3d;
  const v = new Cesium.Viewer(hop, {
    globe: false, baseLayer: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
    navigationHelpButton: false, animation: false, timeline: false, fullscreenButton: false, infoBox: false,
    selectionIndicator: false, skyAtmosphere: new Cesium.SkyAtmosphere(),
  });
  v.scene.primitives.add(await Cesium.createGooglePhotorealistic3DTileset());
  // Nhìn chéo, thấp (nghiêng 18 độ), cách 560 m, nhắm vào tầm thân tòa: thấy mặt đứng chứ không chỉ mái.
  v.camera.lookAt(Cesium.Cartesian3.fromDegrees(b.lng, b.lat, 60),
    new Cesium.HeadingPitchRange(Cesium.Math.toRadians(25), Cesium.Math.toRadians(-18), 560));
}

/** Thẻ Place Details đầy đủ. Google tự vẽ toàn bộ nội dung bên trong. */
function placeDetailsMarkup(placeId) {
  return `
    <gmp-place-details>
      <gmp-place-details-place-request place="${esc(placeId)}"></gmp-place-details-place-request>
      <gmp-place-content-config>
        <gmp-place-media lightbox-preferred></gmp-place-media>
        <gmp-place-rating></gmp-place-rating>
        <gmp-place-type></gmp-place-type>
        <gmp-place-price></gmp-place-price>
        <gmp-place-accessible-entrance-icon></gmp-place-accessible-entrance-icon>
        <gmp-place-opening-hours></gmp-place-opening-hours>
        <gmp-place-website></gmp-place-website>
        <gmp-place-phone-number></gmp-place-phone-number>
        <gmp-place-summary></gmp-place-summary>
        <gmp-place-type-specific-highlights></gmp-place-type-specific-highlights>
        <gmp-place-review-summary></gmp-place-review-summary>
        <gmp-place-reviews></gmp-place-reviews>
        <gmp-place-feature-list></gmp-place-feature-list>
        <gmp-place-attribution light-scheme-color="gray" dark-scheme-color="white"></gmp-place-attribution>
      </gmp-place-content-config>
    </gmp-place-details>`;
}

function wire(body, { building }) {
  const list = body.querySelector('#gg-list');
  const detail = body.querySelector('#gg-detail');
  const map = body.querySelector('#gg-map');

  list?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pid]');
    if (!btn) return;
    list.querySelectorAll('[data-pid]').forEach((x) => {
      const on = x === btn;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-selected', String(on));
    });

    // Đổi Place ID trên thẻ đang có, KHÔNG dựng lại thẻ mới — dựng lại sẽ
    // huỷ bộ nhớ đệm bên trong thành phần và phát sinh thêm lượt gọi.
    const req = detail.querySelector('gmp-place-details-place-request');
    if (req) req.setAttribute('place', btn.dataset.pid);
    else detail.innerHTML = placeDetailsMarkup(btn.dataset.pid);

    const lat = Number(btn.dataset.lat), lng = Number(btn.dataset.lng);
    if (map && Number.isFinite(lat)) map.setAttribute('center', `${lat},${lng}`);
  });

  // Bấm thẳng vào một POI trên bản đồ Google cũng đổi thẻ chi tiết.
  map?.addEventListener('gmp-load', () => {
    try {
      map.innerMap?.addListener('click', (ev) => {
        if (!('placeId' in ev) || !ev.placeId) return;
        ev.stop?.();
        const req = detail.querySelector('gmp-place-details-place-request');
        if (req) req.setAttribute('place', ev.placeId);
      });
    } catch { /* innerMap chưa sẵn sàng */ }
  });

  void building;
}

/* =========================================================================
   NHÚNG VÀO HỒ SƠ TÒA NHÀ

   Danh sách 158 địa điểm trong hồ sơ vốn chỉ là chữ: tên, loại, sao, khoảng
   cách. Payload có sẵn Place ID, nên thẻ gmp-place-details-compact của Google
   vẽ được ảnh thật, giờ mở cửa và đánh giá ngay tại chỗ.

   Vẫn đúng ràng buộc: đây là DANH SÁCH TRONG HỒ SƠ, không phải bản đồ. Nội
   dung Google không hề đặt lên nền OpenStreetMap.

   Nạp theo yêu cầu — mỗi thẻ là một lượt tính tiền.
   ========================================================================= */
export async function enrichProfileWithGoogle(root, { key, shareMode }) {
  const bar = root.querySelector('#pf-gg-bar');
  const rows = [...root.querySelectorAll('.place[data-pid]')].filter((r) => r.dataset.pid);
  if (!bar || !rows.length) return { n: 0 };

  const fail = (msg) => { bar.innerHTML = `<p class="pf__ggerr">${msg}</p>`; };

  if (!key) {
    fail(shareMode
      ? 'Phần Google cố ý tắt trong bản chia sẻ — khoá API không rời khỏi máy chủ.'
      : 'Chưa có khóa API trong <code>config.local.js</code>.');
    return { n: 0 };
  }

  bar.innerHTML = '<span class="pf__ggnote">Đang nạp Google…</span>';
  window.gm_authFailure = () => fail(authHelp('Khóa bị từ chối', 'auth'));
  hookConsole(fail);

  try {
    bootstrap(key);
    await google.maps.importLibrary('places');
  } catch (e) {
    fail(`Không nạp được Google: <code>${esc(e.message)}</code>`);
    return { n: 0 };
  }

  for (const row of rows) {
    const card = document.createElement('div');
    card.className = 'place__gg';
    // Bản gọn: ảnh, sao, loại hình, trạng thái mở cửa. Đúng cỡ cho một dòng
    // trong danh sách; bản đầy đủ quá cao cho ngữ cảnh này.
    card.innerHTML = `
      <gmp-place-details-compact orientation="horizontal" truncation-preferred>
        <gmp-place-details-place-request place="${esc(row.dataset.pid)}"></gmp-place-details-place-request>
        <gmp-place-content-config>
          <gmp-place-media lightbox-preferred></gmp-place-media>
          <gmp-place-rating></gmp-place-rating>
          <gmp-place-type></gmp-place-type>
          <gmp-place-price></gmp-place-price>
          <gmp-place-open-now-status></gmp-place-open-now-status>
          <gmp-place-attribution light-scheme-color="gray" dark-scheme-color="white"></gmp-place-attribution>
        </gmp-place-content-config>
      </gmp-place-details-compact>`;
    row.appendChild(card);
    row.classList.add('has-gg');
  }

  bar.innerHTML = `<span class="pf__ggnote">Đã nạp <b>${rows.length}</b> thẻ Google · `
    + 'ảnh, giờ mở cửa và đánh giá do Google cung cấp</span>';
  return { n: rows.length };
}
