/* =========================================================================
   BẢN ĐỒ KỂ CHUYỆN — mục "Kể chuyện"

   Một bản đồ ĐỨNG YÊN, nội dung cuộn qua nó, mỗi đoạn đổi camera và đổi lớp
   dữ liệu. Đây là bố cục "scrollytelling" mà báo chí dữ liệu dùng, và lý do
   nó hoạt động không phải vì hiệu ứng đẹp: người đọc chỉ giữ được MỘT ý mỗi
   lúc. Bản đồ tĩnh có tám lớp bật cùng lúc bắt người đọc tự tách ý; bản đồ
   kể chuyện tách sẵn, mỗi bước một câu.

   TỰ VIẾT, không thêm thư viện. IntersectionObserver có sẵn trong trình
   duyệt làm đúng việc cần: báo khi một đoạn vào giữa khung nhìn. Kéo thêm
   một thư viện scrollytelling vào đây là thêm phụ thuộc mạng cho một việc
   ba mươi dòng.

   TÔN TRỌNG prefers-reduced-motion: chuyển động camera đổi sang nhảy thẳng,
   số đếm đổi sang hiện luôn. Hiệu ứng là gia vị, không phải nội dung.

   MỌI CON SỐ trong lời kể đều đọc từ tệp dữ liệu lúc chạy, không viết cứng
   vào câu chữ. Nếu chạy lại bộ dựng và số đổi, câu chữ đổi theo. Viết cứng
   một con số vào lời kể là cách chắc chắn nhất để trang này nói dối sau ba
   tháng nữa.
   ========================================================================= */

import { createFlowLayer, FLOW_LEGEND } from './flow.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* Số Việt Nam: dấu chấm phân nhóm nghìn, dấu phẩy thập phân. */
const num = (n, d = 0) => (n == null || !Number.isFinite(n) ? '—'
  : n.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }));

/* NỀN TỐI TỰ VIẾT.

   Positron là nền SÁNG và nhạt. Đặt thang màu pastel lên nền sáng thì dữ
   liệu và nền có cùng độ sáng, và cả bản đồ trông như một ảnh tải hỏng —
   đúng nhận xét của người dùng. Nền tối đẩy dữ liệu lên hẳn một bậc tương
   phản; đó là lý do bản đồ chuyên đề trên báo chí gần như luôn dùng nền tối.

   Tự dựng chỉ sáu lớp: đất, nước, đường nhỏ, đường lớn, và NHÃN ĐỊA DANH.
   Nhãn là thứ quan trọng nhất và là thứ bản trước thiếu hẳn — không có tên
   nơi chốn thì người xem không biết mình đang nhìn chỗ nào.

   Dùng thẳng nguồn vector OpenFreeMap: không khoá, không giới hạn lượt. */
const OFM = 'https://tiles.openfreemap.org';
const DARK_STYLE = {
  version: 8,
  glyphs: OFM + '/fonts/{fontstack}/{range}.pbf',
  sources: { openmaptiles: { type: 'vector', url: OFM + '/planet' } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0A0E13' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': '#101C26' } },
    { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      paint: { 'line-color': '#101C26',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 2.6] } },
    { id: 'road-minor', type: 'line', source: 'openmaptiles',
      'source-layer': 'transportation', minzoom: 11,
      filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
      paint: { 'line-color': '#19222B',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 16, 1.6] } },
    { id: 'road-major', type: 'line', source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'],
        ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'], true, false],
      paint: { 'line-color': '#2B3843',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.4, 12, 1.3, 16, 4] } },
    /* KHỐI NHÀ 3D. minzoom 14: dưới mức đó khối nhà chỉ là nhiễu và tốn GPU,
       còn từ 14 trở lên nó cho chiều sâu đô thị thật quanh nhà ga.
       `render_height` có sẵn trong OpenMapTiles — không phải suy đoán. */
    { id: 'b3d', type: 'fill-extrusion', source: 'openmaptiles',
      'source-layer': 'building', minzoom: 14,
      paint: {
        'fill-extrusion-color': '#1B2733',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.4, 0.9],
      } },

    /* Mọi lớp dữ liệu chèn TRƯỚC lớp này, để nhãn địa danh luôn nằm trên
       cùng — tên nơi chốn bị mảng màu phủ lên thì coi như không có. */
    { id: 'place-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['match', ['get', 'class'],
        ['city', 'town', 'suburb', 'village'], true, false],
      layout: {
        'text-field': ['coalesce', ['get', 'name:vi'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11.5, 13, 15.5],
        'text-max-width': 8, 'text-padding': 8,
      },
      /* Chữ TRẮNG với viền dày, không phải xám nhạt: nhãn nay phải đọc được
         cả trên nền tối lẫn trên mảng lục giác sáng rực. Xám nhạt chỉ đọc
         được ở một trong hai. */
      paint: { 'text-color': '#FFFFFF', 'text-halo-color': '#05080B',
        'text-halo-width': 2.2, 'text-halo-blur': 0.3 } },
  ],
};

/* Tên ga trong bộ dữ liệu đang là tiếng Anh không dấu ("Ben Thanh",
   "Opera House"). Trên một bản đồ tiếng Việt thì đó là lỗi trình bày, và với
   "Opera House" / "National University" thì còn là tên KHÔNG ai gọi ở đây.

   Đối chiếu theo `id` (L101–L114) chứ không theo thứ tự mảng: thứ tự có thể
   đổi khi bộ dữ liệu được dựng lại, `id` thì không. Tên nào không có trong
   bảng thì giữ nguyên tên gốc — thà hiện tiếng Anh còn hơn hiện sai. */
const METRO_VI = {
  L101: 'Bến Thành', L102: 'Nhà hát Thành phố', L103: 'Ba Son',
  L104: 'Công viên Văn Thánh', L105: 'Tân Cảng', L106: 'Thảo Điền',
  L107: 'An Phú', L108: 'Rạch Chiếc', L109: 'Phước Long',
  L110: 'Bình Thái', L111: 'Thủ Đức', L112: 'Khu Công nghệ cao',
  L113: 'Đại học Quốc gia', L114: 'Bến xe Suối Tiên',
};
const metroName = (s) => METRO_VI[s?.id] || s?.name || '';

/* Lục giác ĐỈNH BẰNG quanh một tâm — sáu đỉnh ở 0°, 60°, … 300°. */
function hexPoly(lng, lat, R) {
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const ring = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    ring.push([lng + (R * Math.cos(a)) / mLng, lat + (R * Math.sin(a)) / 110574]);
  }
  ring.push(ring[0]);
  return [ring];
}

/* Tâm ô lục giác dựng lại từ tham số lưới — cột lẻ tụt xuống nửa hàng. */
const hexCenter = (g, c, r) => [
  g.lng0 + c * g.dxLng,
  g.lat0 + r * g.dyLat + (c % 2 ? g.dyLat / 2 : 0),
];

/* Dải thời gian đi bộ. Thang TUẦN TỰ (đậm = gần), không phải phân kỳ: đại
   lượng này không có điểm giữa trung tính để phân kỳ quanh nó.

   Màu MẠNH hẳn, không pastel: trên nền tối, bốn bậc phải tách nhau rõ khi
   nhìn từ xa một mét, không phải khi ghé sát màn hình. */
const BANDS = [
  { max: 5, color: '#2DD4BF', label: 'dưới 5 phút' },
  { max: 10, color: '#4ADE80', label: '5 – 10 phút' },
  { max: 15, color: '#FACC15', label: '10 – 15 phút' },
  { max: 24, color: '#F97316', label: '15 – 24 phút' },
];

/* Dải số tuyến xe buýt tới được — thang tuần tự khác hẳn về sắc để không ai
   nhầm nó với thang thời gian ở trên. */
const ROUTE_BANDS = [
  { max: 4, color: '#FDE68A', label: '0 – 4 tuyến' },
  { max: 9, color: '#FBBF24', label: '5 – 9 tuyến' },
  { max: 19, color: '#F97316', label: '10 – 19 tuyến' },
  { max: 1e9, color: '#DC2626', label: '20 tuyến trở lên' },
];

/* Dải thời gian ĐI LẠI tới ga metro — bậc 15 phút như bài báo. Thang sắc
   lạnh, tách khỏi thang xanh lục (đi bộ) và thang cam (số tuyến), để ba
   bản đồ không bị đọc nhầm sang nhau. */
const TIME_BANDS = [
  { max: 15, color: '#38BDF8', label: 'dưới 15 phút' },
  { max: 30, color: '#4ADE80', label: '15 – 30 phút' },
  { max: 45, color: '#FB923C', label: '30 – 45 phút' },
  { max: 60, color: '#E11D6B', label: '45 – 60 phút' },
];

/* Ô không có giá trị ở khung giờ này (ngoài ngưỡng 60 phút) phải TRONG SUỐT,
   không phải màu dải cuối. `['has', k]` là phép kiểm đúng: thuộc tính vắng
   mặt hẳn, chứ không phải bằng null. */
const timeRamp = (k) => ['case', ['!', ['has', k]], 'rgba(0,0,0,0)',
  ['step', ['get', k],
    TIME_BANDS[0].color, TIME_BANDS[0].max, TIME_BANDS[1].color,
    TIME_BANDS[1].max, TIME_BANDS[2].color, TIME_BANDS[2].max, TIME_BANDS[3].color]];

/* Hai màu, không phải bốn bậc: câu hỏi ở đây là NHỊ PHÂN — trong ngưỡng
   hay ngoài ngưỡng. Giữ bốn bậc trong khi người đọc đang kéo một ngưỡng
   sẽ bắt họ đọc hai hệ mã hoá cùng lúc. */
const threshRamp = (limit) => ['case',
  ['==', ['get', 'bus'], null], 'rgba(0,0,0,0)',
  ['<=', ['get', 'bus'], limit], '#2DD4BF',
  '#26333F'];

/* MẬT ĐỘ DÂN SỐ. Thang riêng, sắc nóng kiểu bản đồ nhiệt — cố tình khác hẳn
   ba thang thời gian ở trên, vì đây là một ĐẠI LƯỢNG KHÁC HẲN về bản chất.
   Ngưỡng lấy từ phân vị đo được trên chính dữ liệu (trung vị 17.059,
   phân vị 90 là 55.025, phân vị 99 là 97.865 người/km²), không phải số tròn
   chọn cho đẹp. */
const DENS_BANDS = [
  { max: 5000, color: '#2C1A4A', label: 'dưới 5.000' },
  { max: 17000, color: '#7B2D8E', label: '5.000 – 17.000' },
  { max: 40000, color: '#C43E6D', label: '17.000 – 40.000' },
  { max: 70000, color: '#F26B33', label: '40.000 – 70.000' },
  { max: 1e9, color: '#FDD835', label: 'trên 70.000' },
];

const densRamp = ['step', ['get', 'dens'],
  DENS_BANDS[0].color, DENS_BANDS[0].max, DENS_BANDS[1].color,
  DENS_BANDS[1].max, DENS_BANDS[2].color, DENS_BANDS[2].max, DENS_BANDS[3].color,
  DENS_BANDS[3].max, DENS_BANDS[4].color];

/* CAO ĐỘ NỀN. Thang đọc theo nghĩa NGẬP, không phải theo nghĩa địa hình:
   chỗ THẤP ăn màu nước và sáng lên, chỗ CAO lùi về xám trung tính. Ngược
   với thang độ cao cổ điển (xanh lá thấp, nâu cao) — vì câu chuyện ở đây
   không phải "chỗ nào là núi" mà "chỗ nào thấp".

   Ngưỡng 1 – 2 – 3 – 5 m là các mốc thực tế trong bản vẽ thoát nước đô thị,
   không phải chia đều cho dễ nhìn. */
const ELEV_BANDS = [
  { max: 1, color: '#22D3EE', label: 'dưới 1 m' },
  { max: 2, color: '#0EA5E9', label: '1 – 2 m' },
  { max: 3, color: '#3B82F6', label: '2 – 3 m' },
  { max: 5, color: '#64748B', label: '3 – 5 m' },
  { max: Infinity, color: '#3F3F46', label: 'trên 5 m' },
];
const elevRamp = ['case', ['==', ['get', 'elev'], null], 'rgba(0,0,0,0)',
  ['step', ['get', 'elev'],
    ELEV_BANDS[0].color, ELEV_BANDS[0].max, ELEV_BANDS[1].color,
    ELEV_BANDS[1].max, ELEV_BANDS[2].color, ELEV_BANDS[2].max, ELEV_BANDS[3].color,
    ELEV_BANDS[3].max, ELEV_BANDS[4].color]];

const bandColor = (v, bands) => {
  if (v == null) return null;
  for (const b of bands) if (v <= b.max) return b.color;
  return null;
};

const legend = (bands, title) => `
  <div class="stleg">
    <span class="stleg__t">${esc(title)}</span>
    <ul>${bands.map((b) => `<li><i style="background:${b.color}"></i>${esc(b.label)}</li>`).join('')}</ul>
  </div>`;

/* ---- khung HTML -------------------------------------------------------- */
export function storyShell() {
  return `
  <div class="story__doc" id="story-root">
    <header class="story__hero">
      <p class="story__kicker">Phân tích khả năng tiếp cận</p>
      <h1 class="story__h1">Metro số 1 và mạng xe buýt nối ga</h1>
      <p class="story__lede">Bài này đo thời gian đi bộ và đi xe buýt tới 14 ga Metro số 1
        theo mạng đường OpenStreetMap, rồi xem vị trí của <span id="st-nb">…</span> tòa văn phòng
        trong bộ dữ liệu.</p>
      <p class="story__meta" id="st-meta">Đang nạp dữ liệu…</p>
      <div class="story__scrollhint" aria-hidden="true">
        <span>Cuộn để đọc</span>
        <svg viewBox="0 0 16 22" width="16" height="22"><rect x="1" y="1" width="14" height="20"
          rx="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle class="story__wheel" cx="8" cy="7" r="1.8" fill="currentColor"/></svg>
      </div>
    </header>

    <div class="story__stage">
      <div class="story__sticky">
        <div class="story__frame">
          <div class="story__map" id="story-map" role="img"
            aria-label="Bản đồ minh họa cho đoạn văn bên cạnh"></div>
          <div class="story__legend" id="story-legend" aria-hidden="true"></div>
        </div>
      </div>

      <div class="story__steps" id="story-steps">
        ${step('intro', '407 tòa văn phòng', `
          <p>Mỗi chấm là một tòa văn phòng. Các tòa tập trung ở Quận 1 và Quận 3 cũ,
            thưa dần ra ngoài.</p>`)}

        ${step('metro', 'Metro số 1: 14 ga', `
          <p>Metro số 1 chạy từ Bến Thành đến Suối Tiên, dài 19,7 km. Các bước tiếp theo
            xem khu vực nào đi bộ tới được một trong 14 ga.</p>`)}

        ${step('metro-reach', 'Vùng đi bộ tới ga', `
          <p id="st-metro-p">…</p>
          <p class="story__note">Tính theo mạng đường đi bộ, tốc độ 75 m/phút, nên sông
            Sài Gòn, kênh Nhiêu Lộc và các khối nhà không có lối đi được tính là vật cản.</p>`)}

        ${step('bus', 'Mạng xe buýt', `
          <p id="st-bus-p">…</p>`)}

        ${step('bus-reach', 'Vùng đi bộ tới trạm xe buýt', `
          <p id="st-busreach-p">…</p>
          <div class="story__big"><b id="st-ratio">…</b><span>diện tích so với metro,
            trong 5 phút đi bộ</span></div>
          <div class="stslider">
            <label for="st-walk">Thời gian đi bộ tối đa
              <b><span id="st-walkv">10</span> phút</b></label>
            <input type="range" id="st-walk" min="3" max="24" step="1" value="10">
            <p class="stslider__out" id="st-walkout">…</p>
          </div>
          <p class="story__note">Vùng tính toán là hình chữ nhật bao quanh 407 tòa nhà,
            thêm 1,2 km mỗi phía.</p>`)}

        ${step('flow', 'Trạm xe buýt dẫn về ga nào', `
          <p id="st-flow-p">…</p>
          <ol class="story__rank story__rank--flow" id="st-flowrank"></ol>
          <p class="story__note">Mỗi tia nối một trạm xe buýt với ga đến nhanh nhất. Đường cong
            chỉ để minh họa, không theo lộ trình xe buýt. Tia càng sáng thì trạm càng nhiều tuyến.</p>`)}

        ${step('relief', 'Mật độ dân số', `
          <p id="st-relief-p">…</p>
          <p>Chiều cao cột là mật độ dân số (người/km²), tỷ lệ thuận: cột cao gấp mười là
            đông gấp mười.</p>
          <p class="story__note">Nguồn: GHS-POP, Ủy ban châu Âu. Đây là dữ liệu ước lượng, phân bổ
            dân số theo diện tích xây dựng; phù hợp để xem phân bố, không dùng để đếm dân từng phường.</p>`)}

        ${step('elevation', 'Cao độ nền', `
          <p id="st-elev-p">…</p>
          <div class="story__big"><b id="st-elev-big">…</b><span>diện tích có cao độ nền
            dưới 5 m</span></div>
          <ol class="story__rank story__rank--elev" id="st-elevbands"></ol>
          <p>Khác với tuyến xe buýt hay ga metro, cao độ nền gần như không đổi theo thời gian.</p>
          <p class="story__note" id="st-elev-gaps">…</p>`)}

        ${step('official', 'Đối chiếu với niên giám thống kê', `
          <p id="st-book-p">…</p>
          <table class="stbook" id="st-book"></table>
          <p class="story__note" id="st-book-note">…</p>`)}

        ${step('routes', 'Số tuyến xe buýt quanh mỗi tòa', `
          <p>Nhiều trạm có thể thuộc cùng một tuyến, nên phần này đếm số tuyến đi qua các trạm
            trong 800 m đi bộ.</p>
          <p id="st-routes-p">…</p>`)}

        ${step('buildings', 'Tòa nhà có nhiều tuyến nhất', `
          <p id="st-build-p">…</p>
          <ol class="story__rank" id="st-rank"></ol>`)}

        ${step('transit-time', 'Đi xe buýt tới ga mất bao lâu', `
          <p id="st-tt-p">…</p>
          <div class="sttoggle" id="st-tt-toggle" role="group" aria-label="Chọn khung giờ"></div>
          <p class="story__note">Tính cả đi bộ (75 m/phút), chờ xe (nửa giãn cách chuyến) và
            thời gian chạy (15 km/h, dừng 20 giây mỗi trạm). Giãn cách và giờ chạy theo lịch trên
            OpenStreetMap, không phải thời gian thực.</p>`)}

        ${step('night', 'Lúc 22h45', `
          <p id="st-night-p">…</p>
          <div class="story__big"><b id="st-nightpct">…</b><span>diện tích tới được ga lúc 22h45
            là nhờ xe buýt; phần còn lại đi bộ cũng tới</span></div>
          <p class="story__note">So với mức chỉ đi bộ để tách riêng phần xe buýt đóng góp.</p>`)}

        ${step('limits', 'Giới hạn của phân tích', `
          <ul class="story__limits" id="st-limits"></ul>`)}
      </div>
    </div>

    <footer class="story__foot">
      <p>Nguồn: OpenStreetMap (ODbL 1.0), GHS-POP, Niên giám Thống kê; 407 tòa văn phòng với
        giá niêm yết 03/2026. Nền bản đồ: OpenFreeMap.</p>
      <p>Cách tính: đếm số địa điểm tới được trong một ngưỡng thời gian (Cervero và Kockelman, 1997).
        Chi tiết ở trang Phương pháp.</p>
    </footer>
  </div>`;
}

function step(id, title, body) {
  return `<section class="ststep" data-step="${id}" tabindex="-1">
    <div class="ststep__card">
      <h2>${esc(title)}</h2>
      ${body}
    </div>
  </section>`;
}

/* ---- gắn vào trang ----------------------------------------------------- */
let mounted = false;
let smap = null;
/* Dựng lại khung hình cảnh hiện tại. Cần khi cửa sổ đổi cỡ: `fitBounds` phụ
   thuộc kích thước khung vẽ và bề rộng thẻ che, cả hai đều đổi theo. */
let reapply = null;
let flowLayer = null;

export async function mountStory(host, ctx) {
  if (mounted) { smap?.resize(); return; }
  mounted = true;

  const { buildings, ml, metroStations } = ctx;
  let grid = null, bus = null, tt = null, flow = null, admin = null, mline = null,
    urb = null, elev = null, dist = null, book = null, raw = null;
  try {
    [grid, bus, tt, flow, admin, mline, urb, elev, dist, book, raw] = await Promise.all([
      fetch('./data/osm_reach_grid.json').then((r) => r.json()),
      fetch('./data/osm_bus_network.json').then((r) => r.json()),
      fetch('./data/osm_transit_time.json').then((r) => r.json()),
      fetch('./data/osm_flow.json').then((r) => r.json()),
      fetch('./data/osm_admin.json').then((r) => r.json()),
      fetch('./data/osm_metro_line.json').then((r) => r.json()),
      fetch('./data/hcm_context.json').then((r) => r.json()),
      fetch('./data/hcm_elevation.json').then((r) => r.json()),
      fetch('./data/vn_districts_old.json').then((r) => r.json()),
      fetch('./data/vn_yearbook_tidy.json').then((r) => r.json()),
      fetch('./data/vn_yearbook_tables.json').then((r) => r.json()),
    ]);
  } catch (err) {
    host.querySelector('#st-meta').textContent = 'Không nạp được dữ liệu phân tích: ' + err.message;
    return;
  }

  fillNumbers(host, { grid, bus, tt, flow, urb, elev, book, raw, buildings });

  /* Nền TỐI, tự dựng — xem chú thích DARK_STYLE ở đầu tệp. */
  smap = new ml.Map({
    container: host.querySelector('#story-map'),
    style: DARK_STYLE,
    center: [106.700, 10.790], zoom: 10.4, pitch: 0, bearing: 0,
    attributionControl: false,
    /* KHÔNG dùng cooperativeGestures. Nó chặn con lăn rồi hiện lớp phủ
       "dùng Ctrl + cuộn" — mà ở đây bản đồ chiếm CẢ màn hình, nên mỗi lần
       người đọc cuộn bài là lớp phủ đó bung ra che hết. Trong bố cục kể
       chuyện, con lăn thuộc về BÀI VIẾT chứ không thuộc về bản đồ: tắt hẳn
       phóng bằng con lăn thì sự kiện cuộn đi thẳng xuống trang.
       Vẫn kéo được, vẫn phóng được bằng nút và bằng nhấp đúp. */
    scrollZoom: false,
  });
  // Kiểu Positron đã mang sẵn dòng ghi nguồn của nó. Thêm customAttribution
  // nữa thì dòng ghi nguồn in hai lần, gần như trùng chữ.
  // Nguồn vector đã tự khai ghi nguồn của nó; thêm dòng nữa là in hai lần.
  smap.addControl(new ml.AttributionControl({ compact: true }));
  // Con lăn đã tắt, nên phải có nút phóng — nếu không thì không còn cách nào.
  smap.addControl(new ml.NavigationControl({ showCompass: false }), 'top-left');

  /* Đo bề cao hộp cuộn và ghi vào biến CSS. Bản đồ dính phải cao đúng bằng
     phần NHÌN THẤY ĐƯỢC, nếu không thì đáy bản đồ và chú giải neo vào đáy
     rơi xuống dưới mép. Đo lại khi đổi kích thước cửa sổ. */
  const scroller = host.closest('.story') || host;
  const measure = () => {
    scroller.style.setProperty('--story-h', scroller.clientHeight + 'px');
    smap?.resize();
  };
  measure();
  new ResizeObserver(() => { measure(); reapply?.(); }).observe(scroller);

  // Lộ ra cho kiểm thử đọc trạng thái camera.
  window.__storyMap = smap;

  await new Promise((res) => smap.on('load', res));
  addLayers(smap, ml, { grid, bus, tt, admin, urb, elev, dist, buildings, metroStations });
  /* Lớp tia dựng SAU khi bản đồ đã tải xong: nó cần `map.project()`, và
     project trước khi có khung nhìn hợp lệ sẽ trả toạ độ vô nghĩa. */
  flowLayer = createFlowLayer(smap, host.querySelector('.story__frame'), flow, mline);

  wireSteps(host, { grid, bus, tt, flow, buildings });
}

/* ---- số liệu trong lời kể (đọc từ tệp, không viết cứng) ----------------- */
function fillNumbers(host, { grid, bus, tt, flow, urb, elev, book, raw, buildings }) {
  const $ = (s) => host.querySelector(s);
  const A = grid.areaKm2;
  const busTot = A.bus.reduce((a, b) => a + b, 0);
  const metTot = (A.metro || []).reduce((a, b) => a + b, 0);
  const ratio = A.metro?.[0] ? busTot && A.bus[0] / A.metro[0] : null;

  $('#st-nb').textContent = num(buildings.length);
  $('#st-meta').textContent = `${num(grid.counts.busStops)} trạm xe buýt · `
    + `${num(bus.counts.refs)} tuyến · dữ liệu ngày `
    + `${new Date(grid._retrievedAt).toLocaleDateString('vi-VN')}`;

  $('#st-metro-p').textContent = `Diện tích đi bộ tới một ga: ${num(A.metro[0], 1)} km² trong 5 phút, `
    + `${num(A.metro[0] + A.metro[1] + A.metro[2], 1)} km² trong 15 phút và ${num(metTot, 1)} km² trong 24 phút.`;

  $('#st-bus-p').textContent = `Vùng tính toán có ${num(grid.counts.busStops)} trạm xe buýt `
    + `thuộc ${num(bus.counts.refs)} tuyến đang chạy.`;

  $('#st-busreach-p').textContent = `Diện tích đi bộ tới một trạm xe buýt: ${num(A.bus[0], 1)} km² `
    + `trong 5 phút và ${num(busTot, 1)} km² trong 24 phút, gần như cả vùng tính toán.`;
  $('#st-ratio').textContent = ratio ? num(Math.round(ratio)) + '×' : '—';

  const counts = Object.values(bus.buildings)
    .map((r) => (r.routes['800'] || r.routes[800] || []).length).sort((a, b) => a - b);
  const med = counts[Math.floor(counts.length / 2)];
  const zero = counts.filter((c) => c === 0).length;
  $('#st-routes-p').textContent = `Trung vị ${num(med)} tuyến mỗi tòa, cao nhất `
    + `${num(counts[counts.length - 1])}.`
    + `${zero ? ` ${num(zero)} tòa không có tuyến nào trong 800 m.` : ''}`;

  const rank = Object.entries(bus.buildings)
    .map(([id, r]) => ({ id, n: (r.routes['800'] || r.routes[800] || []).length,
      min: r.nearestStopMin }))
    .sort((a, b) => b.n - a.n).slice(0, 8);
  const byId = new Map(buildings.map((b) => [b.id, b]));
  $('#st-build-p').textContent = `Xếp theo số tuyến trong 800 m đi bộ. `
    + `${num(bus.counts.stops - bus.counts.stopsWithRoute)} trạm chưa có thông tin tuyến trên `
    + `OpenStreetMap nên chưa được tính.`;
  $('#st-rank').innerHTML = rank.map((r) => {
    const b = byId.get(r.id);
    return `<li><span class="story__rankn">${num(r.n)}</span>
      <span class="story__rankw"><b>${esc(b?.name || r.id)}</b>
      <i>${esc(b?.district || '')}${r.min != null ? ` · trạm gần nhất ${num(r.min, 1)} phút` : ''}</i></span></li>`;
  }).join('');

  /* Thời gian tới ga bằng xe buýt, theo khung giờ. */
  const tot = (k) => (tt.windows[k]?.areaKm2 || []).reduce((a, b) => a + b, 0);
  const walk = tot('walkonly');
  $('#st-tt-p').textContent = `Diện tích tới được một ga metro trong 60 phút: `
    + `${num(tot('morning'), 1)} km² lúc 6h sáng, ${num(tot('midday'), 1)} km² giữa ngày. `
    + `Chọn khung giờ để xem trên bản đồ.`;

  $('#st-tt-toggle').innerHTML = ['morning', 'midday', 'late'].map((k, i) => `
    <button type="button" data-win="${k}" aria-pressed="${i === 0}">
      ${esc((tt.windows[k]?.label || k).split('·')[0].trim())}
      <i>${num(tot(k), 1)} km²</i></button>`).join('');

  const nightAdd = tot('late') - walk;
  $('#st-night-p').textContent = `Lúc 22h45 còn ${num(tt.windows.late.liveRoutes)} trên `
    + `${num(tt.windows.morning.liveRoutes)} tuyến chạy. Diện tích tới được ga trong 60 phút là `
    + `${num(tot('late'), 1)} km², trong đó ${num(walk, 1)} km² đi bộ cũng tới. Phần xe buýt thêm vào `
    + `là ${num(nightAdd, 1)} km², so với ${num(tot('morning') - walk, 1)} km² lúc 6h sáng.`;
  $('#st-nightpct').textContent = tot('late')
    ? Math.round((nightAdd / tot('late')) * 100) + '%' : '—';

  /* Bước tia. Con số quan trọng nhất ở đây là mức độ DỒN về Bến Thành —
     nó nói mạng buýt hiện tại phục vụ metro rất lệch. */
  const fst = [...(flow.stations || [])].sort((a, b) => (b.stops || 0) - (a.stops || 0));
  const totalFlow = (flow.flows || []).length;
  const topSt = fst[0];
  $('#st-flow-p').innerHTML = `Mỗi trạm xe buýt được gán về ga đến nhanh nhất. Trong `
    + `${num(totalFlow)} trạm, ${esc(metroName(topSt))} nhận ${num(topSt.stops)} trạm `
    + `(${Math.round((topSt.stops / totalFlow) * 100)}%). Các ga cuối tuyến gần như không có trạm nào.`;
  $('#st-flowrank').innerHTML = fst.slice(0, 6).map((s) => {
    const pct = Math.round((s.stops / Math.max(1, fst[0].stops)) * 100);
    return `<li><span class="story__rankn">${num(s.stops)}</span>
      <span class="story__rankw"><b>${esc(metroName(s))}</b>
      <i class="story__bar"><u style="width:${pct}%"></u></i></span></li>`;
  }).join('');

  /* Con số dân số đọc từ tệp lúc chạy, không viết cứng. */
  const totPop = urb?.totals?.population || 0;
  const densAll = (urb?.cells || []).map((c) => c[2] / (urb.grid.areaKm2PerCell))
    .filter((v) => v > 0).sort((a, b) => a - b);
  const dq = (t) => Math.round(densAll[Math.floor(t * densAll.length)] || 0);
  /* Gọi ĐÚNG TÊN: 'nơi đông nhất' là giá trị LỚN NHẤT, không phải phân vị 99,9.
     Hai số này lệch nhau hơn hai lần (354.518 so với 163.594) — dùng phân vị mà
     gọi là lớn nhất thì con số vẫn đúng nhưng câu chữ nói sai. */
  const densMax = Math.round(densAll[densAll.length - 1] || 0);
  $('#st-relief-p').textContent = `Vùng tính toán có ${num(totPop)} người. Mật độ cao nhất `
    + `${num(densMax)} người/km², phân vị 99 là ${num(dq(0.99))}, trung vị ${num(dq(0.5))}.`;

  fillElevation(host, elev, grid);
  fillYearbook(host, book, raw, urb);

  // Danh sách giới hạn viết lại cho người đọc; bản đầy đủ theo từng tệp vẫn nằm ở trường _gaps của dữ liệu.
  $('#st-limits').innerHTML = [
    'Bài này mô tả khả năng đi lại, không đo tác động của metro lên giá thuê.',
    'Giờ chạy và giãn cách xe buýt theo lịch trên OpenStreetMap, không phải thời gian thực.',
    'Tốc độ xe buýt giả định 15 km/h cho mọi tuyến và mọi giờ; tuyến không ghi giãn cách được tính 20 phút.',
    `${num(bus.counts.stops - bus.counts.stopsWithRoute)} trạm chưa có thông tin tuyến, nên số tuyến có thể thấp hơn thực tế.`,
    'Ô cách đường quá 150 m hoặc cách mọi trạm quá 1.800 m đi bộ được để trống.',
  ].map((g) => `<li>${esc(g)}</li>`).join('');
}

/* CAO ĐỘ NỀN — phân bố theo dải, tính TẠI CHỖ từ dữ liệu.

   Con số trong bài KHÔNG được viết cứng vào chữ. Nếu ngày mai đổi nguồn
   cao độ hay đổi ngưỡng dải, câu văn phải đổi theo, và cách duy nhất bảo
   đảm điều đó là đếm lại mỗi lần vẽ.

   Đơn vị là DIỆN TÍCH chứ không phải số ô, vì các ô bằng nhau nên hai cách
   cho cùng tỉ lệ — nhưng nói bằng km² thì người đọc hình dung được. */
function fillElevation(host, elev, grid) {
  const $ = (x) => host.querySelector(x);
  const cells = elev?.cells || [];
  if (!cells.length) { $('#st-elev-p').textContent = 'Không nạp được dữ liệu cao độ.'; return; }
  const cellKm2 = grid.grid.areaKm2PerCell;

  const cnt = ELEV_BANDS.map(() => 0);
  for (const [, , v] of cells) {
    let i = ELEV_BANDS.findIndex((b) => v < b.max);
    if (i < 0) i = ELEV_BANDS.length - 1;
    cnt[i]++;
  }
  const tot = cells.length;
  const under5 = tot - cnt[cnt.length - 1];
  const under2 = cnt[0] + cnt[1];
  const pct = (k) => Math.round((k / tot) * 1000) / 10;

  $('#st-elev-big').textContent = num(pct(under5), 1) + '%';
  $('#st-elev-p').textContent = 'Cao độ nền trung vị ' + num(elev.stats.p50, 1) + ' m, thấp nhất '
    + num(elev.stats.min, 1) + ' m, cao nhất ' + num(elev.stats.max, 1) + ' m. '
    + num(under2 * cellKm2, 1) + ' km² (' + num(pct(under2), 1) + '% diện tích) thấp hơn 2 m.';

  $('#st-elevbands').innerHTML = ELEV_BANDS.map((b, i) => '<li>'
    + '<span class="story__rankn story__swatch" style="background:' + b.color + '"></span>'
    + '<span class="story__rankw"><b>' + esc(b.label) + '</b>'
    + '<i>' + num(cnt[i] * cellKm2, 1) + ' km² · ' + num(pct(cnt[i]), 1) + '%</i>'
    + '<span class="stbar" style="--w:' + pct(cnt[i]) + '%;--c:' + b.color + '"></span>'
    + '</span></li>').join('');

  $('#st-elev-gaps').textContent = 'Dùng để xem xu hướng chung, không dùng cho từng thửa đất.';
}

/* SỐ LIỆU CHÍNH THỨC — và phép đối chứng đắt giá nhất trong dự án.

   Mọi lớp dân số ở các bước trước đến từ GHS-POP: một MÔ HÌNH vệ tinh phân
   bổ dân số xuống ô lưới theo diện tích đã xây dựng. Không ai đi đếm từng
   người trong từng ô đó. Câu hỏi đúng phải hỏi là: mô hình ấy sai bao nhiêu?

   Niên giám Thống kê là điều tra dân số của Cục Thống kê — một phép đo hoàn
   toàn ĐỘC LẬP, khác phương pháp, khác cơ quan, khác năm. Đặt hai con số
   cạnh nhau là phép kiểm thật, không phải trang trí.

   Lưu ý về phạm vi: tổng của lưới KHÔNG bằng dân số toàn thành phố — lưới
   phủ hộp bao quanh 407 tòa nhà, ăn sang cả Bình Dương, Đồng Nai, Long An,
   mà lại cắt mất Cần Giờ và phần lớn Củ Chi. Hai con số so được với nhau vì
   diện tích bù trừ, không vì chúng đo cùng một vùng. Nói rõ điều đó ra. */
const BOOK_ROWS = [
  { page: '107', label: 'Dân số trung bình', unit: 'nghìn người' },
  { page: '174', label: 'Lao động có việc làm', unit: 'nghìn người' },
  { page: '190', label: 'Năng suất lao động', unit: 'triệu đồng/lao động' },
];
const BOOK_YEARS = ['2020', '2021', '2022', '2023', 'sơ bộ 2024'];

function fillYearbook(host, book, raw, urb) {
  const $ = (x) => host.querySelector(x);
  const hcm = book?.provinces?.['TP. Hồ Chí Minh'];
  if (!hcm) {
    $('#st-book-p').textContent = 'Không nạp được số liệu niên giám.';
    return;
  }

  /* Dân số mô hình: cộng thẳng từ lưới, không lấy con số viết sẵn. */
  const modelPop = (urb?.cells || []).reduce((a, c) => a + (c[2] || 0), 0);
  const official = (hcm['107'] || [])[4];   // sơ bộ 2024, đơn vị nghìn người
  const off = official != null ? official * 1000 : null;
  const gapPct = off ? Math.abs(modelPop - off) / off * 100 : null;

  $('#st-book-p').textContent = 'Dân số theo lưới ước lượng: ' + num(Math.round(modelPop))
    + ' người. Dân số TP.HCM (ranh giới cũ) năm 2024 theo Cục Thống kê: ' + num(off)
    + '. Chênh lệch ' + (gapPct == null ? '—' : num(gapPct, 1) + '%') + '.';

  const head = '<tr><th>Chỉ tiêu</th>' + BOOK_YEARS.map((y) => '<th>' + esc(y) + '</th>').join('') + '</tr>';
  const body = BOOK_ROWS.map((r) => {
    const v = hcm[r.page];
    if (!v) return null;
    return '<tr><th scope="row">' + esc(r.label) + '<i>' + esc(r.unit) + '</i></th>'
      + BOOK_YEARS.map((_, i) => '<td>' + num(v[i], 1) + '</td>').join('') + '</tr>';
  }).filter(Boolean).join('');
  $('#st-book').innerHTML = head + body;

  /* Bản thân con số trong bảng cũng phải tự chứng minh.

     Niên giám PDF dùng bảng mã phông phi chuẩn: `pdftotext` đọc ra chữ Việt
     hỏng hết dấu, nhưng CHỮ SỐ là ASCII nên trích ra chính xác về mặt cơ học.
     Mô hình đọc ảnh thì ngược lại — chữ Việt đúng, chữ số có thể nhìn nhầm.
     Hai công cụ sai ở hai chỗ khác nhau, nên chỗ chúng khớp là chỗ tin được.
     Tỉ lệ khớp đọc thẳng từ tệp, không viết cứng vào câu. */
  const kt = (raw?.tables || []).filter((t) => t.check?.checked);
  const soSo = kt.reduce((a, t) => a + (t.check.modelNumbers || 0), 0);
  const lech = kt.reduce((a, t) => a + (t.check.notInText || 0), 0);
  const khop = soSo ? Math.round((soSo - lech) / soSo * 1000) / 10 : null;

  $('#st-book-note').textContent = 'Hai vùng không trùng nhau: lưới gồm một phần Bình Dương, '
    + 'Đồng Nai, Long An cũ nhưng thiếu Cần Giờ và phần lớn Củ Chi. '
    + 'Nguồn: Niên giám Thống kê Việt Nam 2023, Cục Thống kê (nso.gov.vn).';
  void khop;
}

/* ---- lớp bản đồ -------------------------------------------------------- */
/* RANH GIỚI HÀNH CHÍNH — câu trả lời cho "đâu là TP.HCM".

   Đặt ngay trên nền và DƯỚI mọi lớp dữ liệu: nó là khung tham chiếu, không
   phải nội dung. Nhưng đường viền tỉnh vẽ THÊM một lần nữa ở trên cùng dưới
   dạng nét mảnh sáng, vì mảng lục giác phủ kín sẽ nuốt mất đường viền nằm
   dưới — mà chính lúc mảng phủ kín là lúc người xem cần đường viền nhất.

   Nhãn tên tỉnh dùng `symbol-placement: line` để chữ CHẠY DỌC đường biên
   thay vì đứng một chỗ giữa vùng: tên đặt giữa vùng sẽ đè lên dữ liệu, còn
   tên chạy dọc biên thì đọc được mà không che gì. */
function addAdmin(m, admin) {
  if (!admin?.layers) return;
  m.addSource('adm-prov', { type: 'geojson', data: admin.layers.province });
  m.addSource('adm-ward', { type: 'geojson', data: admin.layers.ward });

  m.addLayer({
    id: 'adm-ward-line', type: 'line', source: 'adm-ward', minzoom: 10.5,
    paint: {
      'line-color': '#38495A',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, 0.3, 15, 1],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10.5, 0, 12, 0.55],
    },
  }, 'place-label');
  m.addLayer({
    id: 'adm-prov-line', type: 'line', source: 'adm-prov',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': '#7C93A8',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2.4, 15, 3.4],
      'line-opacity': 0.85,
    },
  }, 'place-label');

  /* Ranh giới PHƯỜNG vẽ thêm một lần TRÊN dữ liệu — đây mới là lớp định vị
     có ích ở mức phóng của bài (xem phát hiện về sáp nhập bên dưới). Nét
     mảnh và mờ để chia ô mà không cạnh tranh với dữ liệu. */
  m.addLayer({
    id: 'adm-ward-top', type: 'line', source: 'adm-ward', minzoom: 10,
    paint: {
      'line-color': '#0B1016',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.4, 15, 1.4],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 13, 0.5],
    },
  }, 'place-label');

  /* Bản sao nằm TRÊN dữ liệu: nét mảnh, sáng, có nhoè nhẹ. */
  m.addLayer({
    id: 'adm-prov-top', type: 'line', source: 'adm-prov',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': '#FFFFFF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 12, 1.6, 15, 2.2],
      'line-opacity': 0.75, 'line-blur': 0.4,
    },
  }, 'place-label');

  /* PHÁT HIỆN, ghi lại ở đây vì nó quyết định cách vẽ:

     Sau khi sắp xếp lại đơn vị hành chính năm 2025, "Thành phố Hồ Chí Minh"
     trong OSM trải từ 105,98° đến 108,43° kinh đông và 8,35° đến 11,50° vĩ
     bắc — gồm cả Bình Dương, Bà Rịa – Vũng Tàu và đảo xa. Vùng nghiên cứu
     (106,59–106,81) nằm TRỌN bên trong.

     Nghĩa là ở mức phóng của bài này, ranh giới CẤP TỈNH không trả lời được
     câu "đâu là TP.HCM" — vì tất cả những gì thấy trên màn hình đều là
     TP.HCM. Lớp định vị có ích ở đây là PHƯỜNG/XÃ, không phải tỉnh.

     Vẫn giữ mặt nạ: ở mức thu nhỏ hết cỡ nó có tác dụng, và nó không tốn gì
     khi không có phần nào để làm tối. */
  /* MẶT NẠ HÌNH – NỀN.

   Đường viền thôi chưa đủ khi mảng dữ liệu phủ kín màn hình: mắt vẫn đọc
   tất cả như một khối. Làm TỐI phần ngoài thành phố thì TP.HCM lập tức trở
   thành HÌNH và phần còn lại thành NỀN — đây là kỹ thuật cơ bản của bản đồ
   chuyên đề, và là câu trả lời trực tiếp cho "không biết đâu là TP.HCM".

   Dựng bằng một đa giác phủ cả thế giới, KHOÉT LỖ đúng hình thành phố.
   Không cắt dữ liệu: ô lưới ngoài ranh giới vẫn còn đó, vẫn tính vào con
   số công bố, chỉ bị làm mờ đi. Cắt dữ liệu cho đẹp mắt sẽ làm sai số liệu.

   Đặt DƯỚI nhãn nhưng TRÊN dữ liệu, và dưới bản sao đường viền sáng. */
  const hcm = (admin.layers.province.features || [])
    .find((x) => /Hồ Chí Minh/i.test(x.properties?.name || ''));
  if (hcm) {
    const world = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
    m.addSource('adm-mask', { type: 'geojson', data: {
      type: 'Feature', properties: {},
      geometry: { type: 'Polygon', coordinates: [world, ...hcm.geometry.coordinates] },
    } });
    m.addLayer({
      id: 'adm-mask-fill', type: 'fill', source: 'adm-mask',
      paint: { 'fill-color': '#05080B', 'fill-opacity': 0.62 },
    }, 'adm-prov-top');
  }

  m.addLayer({
    id: 'adm-prov-label', type: 'symbol', source: 'adm-prov', minzoom: 8.5,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 15],
      'text-letter-spacing': 0.14, 'text-max-angle': 28, 'text-padding': 4,
    },
    paint: {
      'text-color': '#CBD8E3', 'text-halo-color': '#070A0E', 'text-halo-width': 2,
    },
  });
}

/* TÊN QUẬN/HUYỆN TIẾNG VIỆT.

   geoBoundaries ghi tên KHÔNG DẤU ("Quan 1", "Binh Thanh", "Go Vap"). Trên
   một bản đồ tiếng Việt đó là lỗi trình bày. Bảng này đối chiếu theo đúng
   chuỗi gốc không dấu; nhãn nào không có trong bảng thì GIỮ NGUYÊN — thà
   hiện không dấu còn hơn hiện sai.

   Đây là 24 quận/huyện của TP.HCM TRƯỚC sắp xếp 2025, cộng các huyện giáp
   ranh của Bình Dương, Đồng Nai, Long An, Tiền Giang có trong khung nhìn.

   "Chau Thanh" xuất hiện HAI lần (Tiền Giang và Long An) — trùng tên là
   chuyện bình thường ở cấp huyện, cả hai đều nắn về cùng một chữ. */
const DISTRICT_VI = {
  'Quan 1': 'Quận 1', 'Quan 2': 'Quận 2', 'Quan 3': 'Quận 3', 'Quan 4': 'Quận 4',
  'Quan 5': 'Quận 5', 'Quan 6': 'Quận 6', 'Quan 7': 'Quận 7', 'Quan 8': 'Quận 8',
  'Quan 9': 'Quận 9', 'Quan 10': 'Quận 10', 'Quan 11': 'Quận 11', 'Quan 12': 'Quận 12',
  'Binh Thanh': 'Bình Thạnh', 'Binh Tan': 'Bình Tân', 'Go Vap': 'Gò Vấp',
  'Phu Nhuan': 'Phú Nhuận', 'Tan Binh': 'Tân Bình', 'Tan Phu': 'Tân Phú',
  'Thu Duc': 'Thủ Đức', 'Binh Chanh': 'Bình Chánh', 'Can Gio': 'Cần Giờ',
  'Cu Chi': 'Củ Chi', 'Hoc Mon': 'Hóc Môn', 'Nha Be': 'Nhà Bè',
  'Di An': 'Dĩ An', 'Thuan An': 'Thuận An', 'Thu Dau Mot': 'Thủ Dầu Một',
  'Ben Cat': 'Bến Cát', 'Tan Uyen': 'Tân Uyên', 'Bac Tan Uyen': 'Bắc Tân Uyên',
  'Bien Hoa': 'Biên Hòa', 'Nhon Trach': 'Nhơn Trạch', 'Trang Bom': 'Trảng Bom',
  'Ben Luc': 'Bến Lức', 'Duc Hoa': 'Đức Hòa', 'Can Giuoc': 'Cần Giuộc',
  'Can Duoc': 'Cần Đước', 'Tan An': 'Tân An', 'Tan Tru': 'Tân Trụ',
  'Thu Thua': 'Thủ Thừa', 'Chau Thanh': 'Châu Thành', 'Trang Bang': 'Trảng Bàng',
  'My Tho': 'Mỹ Tho', 'Cho Gao': 'Chợ Gạo', 'Go Cong': 'Gò Công',
  'Go Cong Dong': 'Gò Công Đông', 'Go Cong Tay': 'Gò Công Tây',
};

/* LỚP QUẬN/HUYỆN CŨ — lớp định vị mà người Sài Gòn thật sự dùng.

   Sau sắp xếp 2025, OSM chỉ còn cấp tỉnh và cấp phường/xã; cấp quận biến
   mất khỏi dữ liệu. Nhưng trong đời sống không ai nói "phường Bến Thành,
   TP.HCM" mà nói "Quận 1". Không có lớp này thì người bản địa nhìn bản đồ
   cũng không biết đang ở đâu.

   Nhãn đặt ở TÂM đơn vị (đã tính sẵn trong dữ liệu, không phải tâm hộp
   bao), chữ hoa giãn nét, không nền — để nó đọc ra như TÊN MỘT VÙNG chứ
   không như một điểm đánh dấu. */
function addDistricts(m, dist) {
  if (!dist?.features?.length) return;
  const feats = dist.features.map((ft) => ({
    ...ft,
    properties: { ...ft.properties, vi: DISTRICT_VI[ft.properties.name] || ft.properties.name },
  }));
  m.addSource('dist', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
  m.addSource('dist-pt', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: feats.map((ft) => ({
        type: 'Feature', properties: ft.properties,
        geometry: { type: 'Point', coordinates: [ft.properties.cx, ft.properties.cy] },
      })),
    },
  });

  m.addLayer({
    id: 'dist-line', type: 'line', source: 'dist',
    layout: { 'line-join': 'round' },
    paint: {
      'line-color': '#93A4B8',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.5],
      'line-opacity': 0, 'line-dasharray': [3, 2.5],
    },
  }, 'place-label');
  m.addLayer({
    id: 'dist-label', type: 'symbol', source: 'dist-pt',
    layout: {
      'text-field': ['get', 'vi'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 17],
      'text-letter-spacing': 0.16,
      'text-transform': 'uppercase',
      'text-padding': 12,
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#DCE5EF', 'text-halo-color': '#05080B',
      'text-halo-width': 2.4, 'text-opacity': 0,
    },
  });
}

function addLayers(m, ml, { grid, bus, tt, admin, urb, elev, dist, buildings, metroStations }) {
  addDistricts(m, dist);
  addAdmin(m, admin);
  const g = grid.grid;
  /* Dân số và chiều cao nhà gắn vào ĐÚNG các lục giác đã có, tra theo
     khoá "cột:hàng". Hai bộ dùng chung một lưới nên không cần ghép lại. */
  /* Cao độ gieo từ tệp riêng nhưng DÙNG chung một hệ lục giác với lưới
     tiếp cận (kiểm được: 9.165/9.165 ô khớp khoá c:r), nên chỉ cần tra bảng. */
  const elevMap = new Map();
  for (const [c, r, e] of (elev?.cells || [])) elevMap.set(c + ':' + r, e);
  const ctxMap = new Map();
  for (const [c, r, pop, bh] of (urb?.cells || [])) ctxMap.set(c + ':' + r, [pop, bh]);
  const cellKm2 = urb?.grid?.areaKm2PerCell || g.areaKm2PerCell || 0.0439;

  const feats = [];
  for (const [c, r, mBus, mMetro] of grid.cells) {
    const [lng, lat] = hexCenter(g, c, r);
    const cx = ctxMap.get(c + ':' + r);
    feats.push({
      type: 'Feature',
      properties: {
        bus: mBus, metro: mMetro,
        pop: cx ? cx[0] : 0,
        dens: cx ? Math.round(cx[0] / cellKm2) : 0,
        bh: cx && cx[1] != null ? cx[1] : null,
        elev: elevMap.has(c + ':' + r) ? elevMap.get(c + ':' + r) : null,
      },
      geometry: { type: 'Polygon', coordinates: hexPoly(lng, lat, g.radiusM) },
    });
  }
  m.addSource('reach', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });

  /* Biểu thức `step` thay vì `interpolate`: các dải này là hạng mục rời rạc
     có ngưỡng công bố, không phải một dải liên tục. Nội suy giữa hai dải sẽ
     vẽ ra những màu không có trong chú giải. */
  const ramp = (field) => ['case', ['==', ['get', field], null], 'rgba(0,0,0,0)',
    ['step', ['get', field],
      BANDS[0].color, BANDS[0].max, BANDS[1].color, BANDS[1].max, BANDS[2].color,
      BANDS[2].max, BANDS[3].color, BANDS[3].max, 'rgba(0,0,0,0)']];

  /* `beforeId` để mảng màu nằm DƯỚI nhãn địa danh. Không có nó thì tên nơi
     chốn bị phủ mất, và bản đồ lại quay về cảnh không biết đang nhìn đâu. */
  m.addLayer({
    id: 'elev-fill', type: 'fill', source: 'reach',
    paint: { 'fill-color': elevRamp, 'fill-opacity': 0, 'fill-antialias': false },
  }, 'place-label');

  m.addLayer({
    id: 'reach-fill', type: 'fill', source: 'reach',
    paint: { 'fill-color': ramp('metro'), 'fill-opacity': 0, 'fill-antialias': false },
  }, 'place-label');

  /* ĐỊA HÌNH TIẾP CẬN — cùng dữ liệu, dựng đứng lên thành khối.

     Chiều cao là (24 − số phút): chỗ ĐI BỘ NHANH tới trạm thì CAO. Đảo dấu
     có chủ đích — mắt đọc "cao = tốt" theo bản năng, còn để nguyên số phút
     thì vùng tệ nhất lại vươn lên cao nhất và cả hình nói ngược.

     Đây là chỗ 3D THẬT SỰ thêm thông tin chứ không trang trí: mảng phẳng
     chỉ phân biệt được bốn bậc màu, còn khối có độ cao liên tục nên đọc
     được cả chuyển tiếp bên trong một bậc.

     Cái giá phải trả và phải nói ra: khối cao che khuất khối thấp phía sau.
     Vì vậy cảnh này KHÔNG dùng để so diện tích — việc đó dành cho cảnh phẳng.
  */
  /* ĐỊA HÌNH DÂN SỐ.

     Bản trước dựng khối theo "phút đi bộ tới trạm buýt". Đo lại thì biến đó
     gần như KHÔNG biến thiên trong không gian: 76% số ô nằm trong 10 phút,
     hệ số biến thiên 0,74. Dựng một biến phẳng thành địa hình chỉ ra một
     cánh đồng cột bằng nhau — ồn ào mà rỗng, đúng như người dùng nhận xét.

     Mật độ dân số thì trải gần hai bậc độ lớn: trung vị 17.059, cao nhất
     163.594 người/km². ĐÓ mới là thứ 3D sinh ra để thể hiện.

     Chiều cao TUYẾN TÍNH theo mật độ, không lấy log. Lấy log sẽ nén đúng
     cái chênh lệch mà hình này sinh ra để cho thấy — muốn nói "chỗ này đông
     gấp mười chỗ kia" thì cột phải cao gấp mười.

     Nguồn GHS-POP của JRC, nền dữ liệu của phương pháp Degree of
     Urbanisation (World Bank / EC / OECD / FAO / UN-Habitat). */
  m.addLayer({
    id: 'reach-3d', type: 'fill-extrusion', source: 'reach',
    paint: {
      'fill-extrusion-color': densRamp,
      'fill-extrusion-height': ['*', ['get', 'dens'], 0.006],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0,
    },
  }, 'place-label');

  /* Bề mặt thời gian đi lại: BA khung giờ gộp vào MỘT nguồn, mỗi khung một
     thuộc tính. Ba nguồn riêng sẽ phải dựng lại ô lưới ba lần và làm nút đổi
     khung giờ giật một nhịp; gộp vào một nguồn thì đổi khung giờ chỉ là đổi
     biểu thức màu, tức là tức thì. */
  const tg = tt.grid;
  const merged = new Map();
  for (const [k, w] of Object.entries(tt.windows)) {
    for (const [c, r, min] of w.cells) {
      const id = c + ':' + r;
      let f = merged.get(id);
      if (!f) { f = { c, r, v: {} }; merged.set(id, f); }
      f.v[k] = min;
    }
  }
  m.addSource('ttime', { type: 'geojson', data: { type: 'FeatureCollection',
    features: [...merged.values()].map(({ c, r, v }) => {
      const [lng, lat] = hexCenter(tg, c, r);
      return { type: 'Feature', properties: v,
        geometry: { type: 'Polygon', coordinates: hexPoly(lng, lat, tg.radiusM) } };
    }) } });
  m.addLayer({
    id: 'ttime-fill', type: 'fill', source: 'ttime',
    paint: { 'fill-color': timeRamp('morning'), 'fill-opacity': 0, 'fill-antialias': false },
  }, 'place-label');

  const line = (metroStations || []).length
    ? { type: 'LineString', coordinates: metroStations
      .filter((s) => Number.isFinite(s.lat ?? s.latitude))
      .map((s) => [s.lng ?? s.longitude, s.lat ?? s.latitude]) }
    : null;
  m.addSource('st-metro', { type: 'geojson',
    data: line ? { type: 'Feature', properties: {}, geometry: line }
      : { type: 'FeatureCollection', features: [] } });
  /* Viền tối rồi mới tới ruột sáng. Một đường đơn sắc chạy qua mảng màu bốn
     bậc sẽ có đoạn trùng màu nền và đứt quãng về thị giác; viền giữ nó liền
     mạch trên mọi màu bên dưới. */
  m.addLayer({
    id: 'st-metro-casing', type: 'line', source: 'st-metro',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#0A0E13',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 5, 14, 11],
      'line-opacity': 0 },
  });
  m.addLayer({
    id: 'st-metro-line', type: 'line', source: 'st-metro',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#F0ABFC',
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.4, 14, 6],
      'line-opacity': 0 },
  });

  m.addSource('st-stops', { type: 'geojson', data: { type: 'FeatureCollection',
    features: (metroStations || []).filter((s) => Number.isFinite(s.lat ?? s.latitude))
      .map((s) => ({ type: 'Feature', properties: { name: metroName(s) },
        geometry: { type: 'Point', coordinates: [s.lng ?? s.longitude, s.lat ?? s.latitude] } })) } });
  m.addLayer({
    id: 'st-stations', type: 'circle', source: 'st-stops',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3.4, 14, 7],
      'circle-color': '#FFFFFF',
      'circle-stroke-color': '#C026D3', 'circle-stroke-width': 2.5,
      'circle-opacity': 0, 'circle-stroke-opacity': 0,
    },
  });

  /* TÊN TỪNG GA. Đây là thứ bản trước thiếu và là lý do người xem không
     đọc được bản đồ: một chuỗi chấm không nói lên nơi chốn nào cả.
     `text-allow-overlap: false` để MapLibre tự bỏ bớt nhãn khi chật, thay
     vì chồng chữ lên nhau — thà thiếu vài tên còn hơn một đống chữ đè. */
  m.addLayer({
    id: 'st-station-labels', type: 'symbol', source: 'st-stops',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10.5, 14, 13],
      'text-offset': [0, -1.15], 'text-anchor': 'bottom',
      'text-padding': 3, 'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#FFFFFF', 'text-halo-color': '#0A0E13',
      'text-halo-width': 1.8, 'text-opacity': 0,
    },
  });

  const routeOf = (id) => {
    const r = bus.buildings[id];
    return r ? (r.routes['800'] || r.routes[800] || []).length : null;
  };
  m.addSource('st-b', { type: 'geojson', data: { type: 'FeatureCollection',
    features: buildings.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
      .map((b) => ({ type: 'Feature', properties: { n: routeOf(b.id), name: b.name || '' },
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] } })) } });
  /* Phạm vi cho từng cảnh, tính từ chính dữ liệu.

     `core` hẹp hơn `buildings`: nó bỏ 5% đuôi mỗi phía để một vài hồ sơ nằm
     lẻ loi ở rìa không kéo khung hình rộng ra gấp đôi. Dùng cho bước xếp
     hạng, chỗ cần nhìn rõ lõi thành phố. */
  const bpts = buildings.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng))
    .map((b) => [b.lng, b.lat]);
  BOUNDS.buildings = boundsOf(bpts);
  const q = (arr, t) => { const v = [...arr].sort((a, b) => a - b);
    return v[Math.min(v.length - 1, Math.floor(t * v.length))]; };
  BOUNDS.core = bpts.length ? [
    [q(bpts.map((p) => p[0]), 0.05), q(bpts.map((p) => p[1]), 0.05)],
    [q(bpts.map((p) => p[0]), 0.95), q(bpts.map((p) => p[1]), 0.95)],
  ] : null;
  BOUNDS.metro = boundsOf((metroStations || [])
    .filter((s) => Number.isFinite(s.lat ?? s.latitude))
    .map((s) => [s.lng ?? s.longitude, s.lat ?? s.latitude]));
  BOUNDS.grid = boundsOf(grid.cells.map(([c, r]) => hexCenter(g, c, r)));
  BOUNDS.ttime = boundsOf([...merged.values()].map(({ c, r }) => hexCenter(tg, c, r)));

  m.addLayer({
    id: 'st-buildings', type: 'circle', source: 'st-b',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.6, 14, 6],
      'circle-color': '#E8F0F5',
      'circle-stroke-color': '#0A0E13', 'circle-stroke-width': 1,
      'circle-opacity': 0, 'circle-stroke-opacity': 0,
    },
  });
}

/* ---- điều phối theo bước cuộn ------------------------------------------ */
/* PHẠM VI DỮ LIỆU, tính từ chính dữ liệu — thay cho mức phóng viết cứng.

   Mức phóng cố định chỉ đúng với đúng một cỡ màn hình. Nó được chọn trên
   khung 1512 × 891; trên màn lớn hơn, cùng mức phóng đó cho thấy một vùng
   rộng gấp đôi và TP.HCM co lại thành một đốm. Ôm theo phạm vi thì khung
   hình đúng ở mọi cỡ màn.

   PHẢI TRỪ PHẦN BỊ THẺ CHE. Thẻ nội dung nằm ĐÈ lên bản đồ ở dải bên phải,
   nên nếu không trừ bề rộng ấy, tâm dữ liệu sẽ rơi xuống dưới thẻ. Bề rộng
   đo từ DOM chứ không viết cứng. */
const BOUNDS = {};

/* Nới phạm vi thêm một tỉ lệ trước khi ôm.

   `fitBounds` đặt đúng hộp bao khít mép vùng vẽ, nên điểm nằm ở rìa hộp —
   như ga Bến Thành ở đầu tây nam hành lang — rơi ngay sát mép và bị cắt,
   nhất là khi có xoay camera (hộp bao xoay rộng hơn hộp bao thẳng). Người
   dùng bắt đúng lỗi này: "ga Bến Thành bị che đi quá nhiều".

   Nới đều hai chiều là cách đúng: nó KHÔNG dời tâm, chỉ chừa lề. */
const padBounds = (b, frac) => {
  if (!b) return b;
  const dx = (b[1][0] - b[0][0]) * frac, dy = (b[1][1] - b[0][1]) * frac;
  return [[b[0][0] - dx, b[0][1] - dy], [b[1][0] + dx, b[1][1] + dy]];
};

function boundsOf(points) {
  let w = Infinity, s = Infinity, e = -Infinity, nn = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < w) w = x; if (x > e) e = x;
    if (y < s) s = y; if (y > nn) nn = y;
  }
  return Number.isFinite(w) ? [[w, s], [e, nn]] : null;
}

/* GÓC CAMERA: nghiêng và xoay ở cảnh KỂ, phẳng ở cảnh ĐO.

   Nghiêng camera làm phần gần lớn ra và phần xa nhỏ đi. Trên một bản đồ mà
   thông điệp LÀ diện tích ("177 km² so với 1,7 km²"), nghiêng là bóp méo
   đúng cái đại lượng đang nói — nên bốn cảnh so diện tích giữ pitch 0.

   Nhưng ở những cảnh chỉ GIỚI THIỆU — 407 chấm, tuyến metro, xếp hạng tòa —
   thì không có diện tích nào để đọc sai, và nghiêng + xoay làm không gian
   đô thị hiện ra có chiều sâu. `fitBounds` mặc định bay theo cung (nó gọi
   `flyTo` bên trong), nên chỉ cần khai pitch/bearing là có chuyển cảnh mượt.

   Xoay cũng phải có LÝ DO: hành lang metro chạy chéo tây nam – đông bắc,
   nên bearing âm dựng nó thẳng đứng hơn trong khung và tận dụng hết chiều
   cao màn hình. Xoay ngẫu nhiên chỉ làm người đọc mất phương hướng. */
const SCENES = {
  intro: {
    fit: 'buildings', pitch: 34, bearing: -18,
    show: { buildings: 1 },
  },
  metro: {
    fit: 'metro', pitch: 50, bearing: -26, pad: 0.14, train: true,
    show: { buildings: 0.35, metro: 1, stations: 1 },
  },
  'metro-reach': {
    fit: 'metro', pitch: 0, bearing: -26, pad: 0.14, train: true,
    field: 'metro', show: { reach: 0.9, metro: 1, stations: 1, buildings: 0.2 },
    legend: ['Đi bộ tới ga metro', BANDS],
  },
  bus: {
    fit: 'buildings', pitch: 28, bearing: -8,
    show: { buildings: 0.25 },
  },
  /* Cảnh này KHÔNG dùng thang bốn bậc mà dùng NGƯỠNG do người đọc đặt.

     Học từ nhóm Konstanz (bản đồ tiếp cận giao thông Đức, 35 triệu ngôi nhà):
     điểm mạnh nhất của họ không phải màu đẹp mà là cho người đọc TỰ CHỈNH
     ngưỡng đi bộ. Một ngưỡng do tác giả chọn luôn là một giả định áp đặt —
     "800 m" hợp lý với người này và vô lý với người khác. Cho chỉnh thì con
     số thôi áp đặt và người đọc tự tìm ra ngưỡng của chính mình. */
  'bus-reach': {
    fit: 'grid', pitch: 0, bearing: 0,
    districts: 0.85,
    field: 'bus', show: { reach: 0.92, buildings: 0.18 }, threshold: true,
    legend: ['Trong ngưỡng bạn đặt', [
      { color: '#2DD4BF', label: 'đi bộ tới được trong ngưỡng' },
      { color: '#26333F', label: 'ngoài ngưỡng' },
    ]],
  },
  /* Cảnh tia: nghiêng vừa phải và xoay theo hành lang metro, để hàng nghìn
     cung hội tụ đọc ra thành hình phễu chứ không thành mớ rối. */
  flow: {
    fit: 'metro', pitch: 38, bearing: -26, pad: 0.16, train: true,
    show: { metro: 1, stations: 1 }, flow: true,
    legend: ['Tia trạm buýt → ga · phút đi', FLOW_LEGEND],
  },
  /* Cảnh 3D: nghiêng SÂU và xoay chậm liên tục. Nghiêng sâu là điều kiện để
     đọc được độ cao — nhìn từ trên xuống thì khối nào cũng phẳng như nhau.
     Xoay chậm cho mắt thấy khối từ nhiều phía, đúng cách một mô hình vật lý
     được xem trong đời thực. */
  relief: {
    fit: 'core', pitch: 62, bearing: -34, pad: 0.05,
    relief: 0.92, show: { metro: 1, stations: 1 }, orbit: 2.2,
    legend: ['Mật độ dân số · người/km²', DENS_BANDS],
  },
  /* Cảnh cao độ: KHÔNG nghiêng. Đại lượng cần đọc là DIỆN TÍCH của từng
     dải màu trên mặt bằng — nghiêng camera làm phần gần phình ra, phần xa
     teo lại, tức là bóp méo đúng cái đang đo. Ranh quận bật lên vì câu hỏi
     đầu tiên người đọc sẽ hỏi là "chỗ thấp đó là quận nào". */
  elevation: {
    fit: 'grid', pitch: 0, bearing: 0,
    elev: 0.95, districts: 1, show: {},
    legend: ['Cao độ nền · mét trên mực nước biển', ELEV_BANDS],
  },
  /* Bước đối chứng: không có lớp chuyên đề nào. Bản đồ lùi về nền + ranh
     quận để mắt nghỉ, còn nội dung nằm ở BẢNG SỐ. Cố nhét một lớp màu vào
     đây chỉ để "có gì đó chuyển động" là làm nhiễu một lập luận bằng số. */
  official: {
    fit: 'grid', pitch: 0, bearing: 0,
    districts: 1, show: { buildings: 0.3 },
  },
  routes: {
    fit: 'buildings', pitch: 30, bearing: 10,
    districts: 0.8,
    field: 'bus', show: { reach: 0.28, buildings: 1 }, byRoutes: true,
    legend: ['Số tuyến buýt trong 800 m đi bộ', ROUTE_BANDS],
  },
  buildings: {
    /* KHÔNG nghiêng. Đây là bản đồ chuyên đề đọc theo DIỆN TÍCH và mật độ
       chấm; nghiêng camera làm phần gần lớn ra, phần xa nhỏ đi, tức là bóp
       méo đúng cái đại lượng bài đang nói. Nghiêng chỉ hợp khi thứ cần đọc
       là chiều cao khối nhà. */
    fit: 'core', pitch: 52, bearing: 22,
    show: { buildings: 1 }, byRoutes: true,
    legend: ['Số tuyến buýt trong 800 m đi bộ', ROUTE_BANDS],
  },
  'transit-time': {
    fit: 'ttime', pitch: 0, bearing: 0,
    districts: 0.8,
    ttField: 'morning', show: { ttime: 0.92, metro: 1, stations: 1 },
    legend: ['Tới ga metro bằng xe buýt', TIME_BANDS],
  },
  night: {
    fit: 'ttime', pitch: 0, bearing: 0,
    districts: 0.8,
    ttField: 'late', show: { ttime: 0.92, metro: 1, stations: 1 },
    legend: ['Tới ga metro lúc 22h45', TIME_BANDS],
  },
  limits: {
    fit: 'grid', pitch: 22, bearing: -12,
    districts: 0.7,
    show: { buildings: 0.5 },
  },
};

/* Ngưỡng đi bộ do NGƯỜI ĐỌC đặt, giữ ở cấp mô-đun vì cả hàm vẽ cảnh lẫn
   hàm nối thanh trượt đều cần đọc nó. */
let walkLimit = 10;

function wireSteps(host, data) {
  const legendEl = host.querySelector('#story-legend');
  const steps = [...host.querySelectorAll('.ststep')];
  let current = null;

  const apply = (id) => {
    if (id === current) return;
    current = id;
    const sc = SCENES[id];
    if (!sc || !smap) return;
    steps.forEach((s) => s.classList.toggle('is-on', s.dataset.step === id));

    /* Đệm phải TRỪ ĐÚNG phần thẻ nội dung che mất, đo từ DOM.

       Thẻ nằm đè lên bản đồ ở dải bên phải. Không trừ thì `fitBounds` căn dữ
       liệu vào giữa TOÀN khung vẽ, tức là căn vào giữa phần một nửa bị che —
       và trọng tâm dữ liệu chui xuống dưới thẻ. */
    const stepsEl = host.querySelector('#story-steps');
    const overlay = stepsEl && getComputedStyle(stepsEl).position !== 'static'
      && window.innerWidth > 900 ? stepsEl.getBoundingClientRect() : null;
    const canvasW = smap.getContainer().clientWidth;
    const rightPad = overlay ? Math.min(canvasW * 0.5, canvasW - overlay.left + 24) : 40;
    const pad = { top: 40, bottom: 56, left: 40, right: Math.max(40, Math.round(rightPad)) };

    const b = padBounds(sc.fit && BOUNDS[sc.fit], sc.pad ?? 0.06);
    if (b) {
      smap.fitBounds(b, {
        padding: pad,
        // Chuyển cảnh dài hơn khi có đổi góc: nghiêng và xoay cần thời gian
        // để mắt bám theo, còn dịch phẳng thì không.
        duration: reduced() ? 0
          : (sc.pitch || sc.bearing ? 2000 : 1300),
        essential: true, maxZoom: 14,
        pitch: reduced() ? 0 : (sc.pitch || 0),
        bearing: reduced() ? 0 : (sc.bearing || 0),
      });
    } else if (sc.cam) {
      const fly = reduced() ? smap.jumpTo.bind(smap) : smap.easeTo.bind(smap);
      fly({ ...sc.cam, duration: reduced() ? 0 : 1400, essential: true });
    }

    const s = sc.show || {};
    const set = (layer, prop, v) => {
      if (smap.getLayer(layer)) smap.setPaintProperty(layer, prop, v);
    };
    if (sc.threshold && smap.getLayer('reach-fill')) {
      smap.setPaintProperty('reach-fill', 'fill-color', threshRamp(walkLimit));
    } else if (sc.field && smap.getLayer('reach-fill')) {
      const bands = sc.byRoutes ? BANDS : BANDS;
      smap.setPaintProperty('reach-fill', 'fill-color',
        ['case', ['==', ['get', sc.field], null], 'rgba(0,0,0,0)',
          ['step', ['get', sc.field],
            bands[0].color, bands[0].max, bands[1].color, bands[1].max, bands[2].color,
            bands[2].max, bands[3].color, bands[3].max, 'rgba(0,0,0,0)']]);
    }
    if (sc.ttField && smap.getLayer('ttime-fill')) {
      smap.setPaintProperty('ttime-fill', 'fill-color', timeRamp(sc.ttField));
      // Nút chọn khung giờ phải theo bước đang đọc, nếu không nó nói một
      // khung giờ trong khi bản đồ vẽ khung giờ khác.
      host.querySelectorAll('#st-tt-toggle [data-win]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.win === sc.ttField));
      });
    }
    flowLayer?.show({ flows: !!sc.flow, train: !!sc.train });
    /* Xoay chỉ bắt đầu SAU khi camera bay xong, nếu không hai chuyển động
       chồng lên nhau và khung hình giật. */
    cancelAnimationFrame(orbitRaf); orbitStop = true;
    if (sc.orbit) setTimeout(() => { if (current === id) startOrbit(sc.orbit); }, 2100);
    // `relief` khai ở CẤP CẢNH, không nằm trong `show` — đọc nhầm chỗ thì
    // lớp 3D dựng đúng nhưng độ mờ luôn bằng 0 và không ai thấy gì.
    set('elev-fill', 'fill-opacity', sc.elev ?? 0);
    // Ranh quận mờ hơn nhãn: nó là khung tham chiếu, không phải nội dung.
    set('dist-line', 'line-opacity', (sc.districts ?? 0) * 0.5);
    set('dist-label', 'text-opacity', sc.districts ?? 0);
    set('reach-3d', 'fill-extrusion-opacity', sc.relief ?? 0);
    set('ttime-fill', 'fill-opacity', s.ttime ?? 0);
    set('reach-fill', 'fill-opacity', s.reach ?? 0);
    set('st-metro-casing', 'line-opacity', (s.metro ?? 0) * 0.9);
    set('st-metro-line', 'line-opacity', s.metro ?? 0);
    set('st-stations', 'circle-opacity', s.stations ?? 0);
    set('st-stations', 'circle-stroke-opacity', s.stations ?? 0);
    set('st-station-labels', 'text-opacity', s.stations ?? 0);
    set('st-buildings', 'circle-opacity', s.buildings ?? 0);
    set('st-buildings', 'circle-stroke-opacity', (s.buildings ?? 0) * 0.9);

    /* Tô tòa nhà theo số tuyến chỉ ở những bước đang NÓI về số tuyến. Ở các
       bước khác chấm giữ màu trung tính, vì lúc đó màu không mang nghĩa gì
       và một thang màu không được giải thích chỉ làm nhiễu. */
    set('st-buildings', 'circle-color', sc.byRoutes
      ? ['case', ['==', ['get', 'n'], null], '#9AA6A0',
        ['step', ['get', 'n'],
          ROUTE_BANDS[0].color, ROUTE_BANDS[0].max + 1, ROUTE_BANDS[1].color,
          ROUTE_BANDS[1].max + 1, ROUTE_BANDS[2].color,
          ROUTE_BANDS[2].max + 1, ROUTE_BANDS[3].color]]
      : '#E8F0F5');
    set('st-buildings', 'circle-radius', sc.byRoutes
      ? ['interpolate', ['linear'], ['zoom'], 9, 3.2, 14, 8]
      : ['interpolate', ['linear'], ['zoom'], 9, 2.6, 14, 6]);

    if (sc.legend) {
      legendEl.innerHTML = legend(sc.legend[1], sc.legend[0]);
      legendEl.classList.add('is-on');
    } else legendEl.classList.remove('is-on');
  };

  /* Ngưỡng đặt ở giữa khung nhìn chứ không phải ở mép: bước đổi đúng lúc
     người đọc đang nhìn vào đoạn đó, không phải lúc nó vừa ló ra. */
  /* Khi KHÔNG đoạn nào nằm trong dải giữa — xảy ra ở đáy trang, lúc đoạn
     cuối đã trôi lên trên dải — thì lấy đoạn có tâm gần tâm dải nhất.

     Không có nhánh này thì hai bước cuối không bao giờ trở thành bước đang
     đọc: cuộn xuống hết trang mà bản đồ vẫn đứng ở cảnh của bước trước đó.
     Đo được đúng như vậy trước khi sửa. */
  const nearest = () => {
    /* Tâm của HỘP CUỘN, không phải tâm khung nhìn. Hộp cuộn bắt đầu dưới
       thanh trên cùng, nên hai tâm lệch nhau vài chục pixel — đủ để bước
       đang đọc lệch một nhịp so với bản đồ. */
    const box = (host.closest('.story') || document.documentElement).getBoundingClientRect();
    const mid = (box.top + box.bottom) / 2;
    let best = null, bestD = Infinity;
    for (const s of steps) {
      const r = s.getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best?.dataset.step;
  };

  /* XOAY CHẬM LIÊN TỤC cho cảnh 3D.

     Một khung hình 3D đứng yên đọc gần như bằng ảnh phẳng: mắt cần THỊ SAI
     — các lớp gần xa dịch chuyển khác nhau — mới dựng lại được chiều sâu.
     Xoay rất chậm (khoảng 2°/giây) tạo ra thị sai đó mà không làm chóng mặt
     và không cướp mất quyền điều khiển: người dùng kéo bản đồ là dừng ngay. */
  let orbitRaf = 0, orbitStop = false;
  smap.on('dragstart', () => { orbitStop = true; });
  function startOrbit(degPerSec) {
    cancelAnimationFrame(orbitRaf);
    if (!degPerSec || reduced()) return;
    orbitStop = false;
    let prev = 0;
    const tick = (now) => {
      if (orbitStop) { orbitRaf = 0; return; }
      const dt = prev ? (now - prev) / 1000 : 0;
      prev = now;
      smap.setBearing(smap.getBearing() + degPerSec * dt);
      orbitRaf = requestAnimationFrame(tick);
    };
    orbitRaf = requestAnimationFrame(tick);
  }

  const io = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    apply(vis ? vis.target.dataset.step : nearest());
  }, { root: host.closest('.story') || null,
    rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.5, 1] });
  steps.forEach((s) => io.observe(s));

  /* Chạm đáy thì không còn ngưỡng nào để vượt qua, nên IntersectionObserver
     im lặng. Bám thêm sự kiện cuộn của chính hộp cuộn, gộp theo khung hình. */
  const scroller = host.closest('.story') || host;
  let raf = 0;
  scroller.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; apply(nearest()); });
  }, { passive: true });

  /* Nút chọn khung giờ. Người đọc bấm nút thì bản đồ đổi ngay, KHÔNG chờ
     cuộn — nhưng cuộn sang bước khác vẫn đặt lại theo bước đó. Hai đường
     điều khiển cùng một thứ, và bước cuộn là đường có thẩm quyền cuối. */
  host.querySelector('#st-tt-toggle')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-win]');
    if (!btn || !smap?.getLayer('ttime-fill')) return;
    smap.setPaintProperty('ttime-fill', 'fill-color', timeRamp(btn.dataset.win));
    smap.setPaintProperty('ttime-fill', 'fill-opacity', 0.92);
    host.querySelectorAll('#st-tt-toggle [data-win]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === btn));
    });
  });

  reapply = () => { const c = current; current = null; apply(c || 'intro'); };

  /* Thanh trượt ngưỡng đi bộ. Diện tích tính LẠI từ chính các ô lưới mỗi
     lần kéo — không phải nội suy từ bốn con số đã công bố, vì nội suy giữa
     hai bậc sẽ ra một con số không tồn tại trong dữ liệu. */
  const cellArea = data.grid.grid.areaKm2PerCell || 0.0439;
  const busVals = data.grid.cells.map((c) => c[2]).filter((v) => v != null);
  const slider = host.querySelector('#st-walk');
  const outEl = host.querySelector('#st-walkout');
  const valEl = host.querySelector('#st-walkv');
  const paintThreshold = () => {
    if (valEl) valEl.textContent = num(walkLimit);
    const inside = busVals.filter((v) => v <= walkLimit).length;
    const km2 = inside * cellArea;
    const pct = Math.round((inside / busVals.length) * 100);
    if (outEl) {
      outEl.innerHTML = `<b>${num(km2, 1)} km²</b> (${pct}% vùng tính toán) đi bộ tới trạm xe buýt `
        + `trong ${num(walkLimit)} phút.`;
    }
    if (smap?.getLayer('reach-fill') && SCENES[current]?.threshold) {
      smap.setPaintProperty('reach-fill', 'fill-color', threshRamp(walkLimit));
    }
  };
  slider?.addEventListener('input', () => {
    walkLimit = Number(slider.value);
    paintThreshold();
  });
  paintThreshold();

  apply('intro');
  countUp(host);
}

/* Số đếm lên khi đoạn của nó vào tầm nhìn. Chỉ trang trí — giá trị cuối
   luôn đúng, và với prefers-reduced-motion thì hiện thẳng giá trị cuối. */
function countUp(host) {
  const targets = [...host.querySelectorAll('.story__big b')];
  if (!targets.length) return;
  if (reduced()) return;
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting || e.target.dataset.ran) continue;
      e.target.dataset.ran = '1';
      const final = e.target.textContent;
      const n = parseInt(final.replace(/\D/g, ''), 10);
      if (!Number.isFinite(n)) continue;
      const t0 = performance.now(), dur = 900;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - (1 - p) ** 3;
        e.target.textContent = num(Math.round(n * eased)) + '×';
        if (p < 1) requestAnimationFrame(tick); else e.target.textContent = final;
      };
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  targets.forEach((t) => io.observe(t));
}

export function resizeStory() { smap?.resize(); reapply?.(); }
