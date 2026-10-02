/* =========================================================================
   Bản đồ — MapLibre GL JS 6.5.0 (BSD-3-Clause), đóng gói cục bộ.

   BẢN ĐỒ 2D THƯỜNG. Không nghiêng camera, không khối 3D. Quyết định của
   người dùng ngày 25/08/2026: bỏ hướng 3D, dùng bản đồ thông thường.

   Cách trình bày marker theo mapcn (mapcn.dev/docs/markers, /docs/popups):
   - Marker là CHẤM TRÒN ĐƠN SẮC, không có nhãn thường trực.
   - Rê chuột hoặc lấy tiêu điểm → tooltip chỉ hiện TÊN.
   - Bấm → popup gắn vào marker, chứa thông tin quyết định.
   Nhờ vậy không còn bài toán chồng nhãn: không có nhãn nào để chồng.

   Ba ràng buộc giữ nguyên:
   1. Nền bản đồ offline từ OpenStreetMap (ODbL), không tile server, không key.
   2. KHÔNG có dữ liệu Google Places trên bề mặt này — chúng chỉ ở dạng danh
      sách trong hồ sơ (GOOGLE_OPEN_MAP_ARCHITECTURE_R1 §3).
   3. Marker là <button> HTML thật, nằm trong tab order, đọc được đầy đủ.
   ========================================================================= */

import { DAY_DU, NHAN } from './che_do.js';
import { distance, money, gradeShort } from './format.js';
import { isPresent } from './data.js';

const BASEMAP_URL = './data/basemap.osm.json';

/* Bảng màu nền bản đồ.

   ĐO, KHÔNG NHÌN. Bản trước lấy thẳng gam sáng của giao diện nên mọi mặt
   phẳng bản đồ dồn vào một khoảng sáng rất hẹp: khối nhà so với nền đất chỉ
   1,060 — mắt không tách được, và bản đồ đọc ra như một mảng trắng.

   Ngưỡng dùng ở đây: hai mặt phẳng KỀ NHAU phải chênh tối thiểu ~1,12 lần
   độ chói. Đây không phải ngưỡng WCAG (WCAG là cho chữ), mà là ngưỡng để
   mắt tách được hai vùng màu lớn nằm cạnh nhau.

     đường / nền đất      1,31      khối nhà / nền đất   1,15
     nước  / nền đất      1,28      khối nhà / đường     1,51           */
const PALETTE = {
  light: {
    earth: '#DCE3DD', green: '#C7DAC8', water: '#B4CCDB',
    road: '#FFFFFF', casing: '#BFCCC2', metro: '#0079B8',
    station: '#FFFFFF', ring: '#47574F',
    building: '#CBD5CD', buildingLine: '#B4C2B7',
    rail: '#6B7A72', bus: '#8CA096', busIcon: '#456175', metro2: '#8A5FC4',
    iso: ['#164A40', '#3D786B', '#6FA396'],
    isoFill: ['rgba(22,74,64,0.13)', 'rgba(61,120,107,0.10)', 'rgba(111,163,150,0.08)'],
    routeCasing: '#FAFBFA',
  },
  dark: {
    earth: '#0D1512', green: '#132019', water: '#0C1D28',
    road: '#3A4B44', casing: '#1B2721', metro: '#3AA0DD',
    station: '#0A100E', ring: '#9CACA5',
    building: '#1E2B25', buildingLine: '#2A3830',
    rail: '#7E8F88', bus: '#46574F', busIcon: '#8FB0C9', metro2: '#A98BE0',
    iso: ['#9BDCC7', '#68B5A3', '#468A7A'],
    isoFill: ['rgba(155,220,199,0.14)', 'rgba(104,181,163,0.10)', 'rgba(70,138,122,0.08)'],
    routeCasing: '#0A100E',
  },
};

/* Màu cho từng nhóm tiện ích mở. Mỗi nhóm có icon riêng nên màu chỉ là kênh
   phụ — không bao giờ là kênh duy nhất.

   `kinds`  giữ NHÃN ĐÚNG NGHĨA. Nhóm cũ tên "Đi lại" gộp 2.356 trạm xe buýt
            với 18 ga, 6 cửa metro và 1 "đại lý du lịch" gắn nhầm thẻ. Đổi tên
            thành "Trạm xe buýt" mà vẫn để nguyên hỗn hợp đó là dán nhãn sai,
            nên nhóm này lọc còn đúng `bus_stop`. Ga và metro không mất đi —
            chúng đã có lớp đường sắt/metro riêng trên bản đồ.
   `hidden` tạm ẩn khỏi phần chọn nhóm. KHÔNG xóa khỏi dữ liệu, và KHÔNG đổi
            công thức mật độ: entropy vẫn tính trên N = 8 nhóm cố định, vì đổi
            N sẽ làm mọi số đa dạng đã công bố không còn so được với nhau. */
const AMENITY_STYLE = {
  food:        { label: 'Ăn uống',   color: '#A2543F', icon: 'utensils' },
  transit:     { label: 'Trạm xe buýt', color: '#1F5E86', icon: 'bus',
                 kinds: ['bus_stop'] },
  convenience: { label: 'Mua sắm',   color: '#7A4B86', icon: 'cart' },
  banking:     { label: 'Ngân hàng', color: '#2C5C93', icon: 'bank' },
  health:      { label: 'Y tế',      color: '#9B3B4E', icon: 'cross' },
  fitness:     { label: 'Thể thao',  color: '#2F6B4F', icon: 'dumbbell' },
  hotel:       { label: 'Khách sạn', color: '#6B5A8E', icon: 'bed' },
  parking:     { label: 'Bãi đỗ xe', color: '#5A6B63', icon: 'car', hidden: true },
};

/* =========================================================================
   NỀN BẢN ĐỒ — sáu lựa chọn.

   Ba cái đầu dựng từ CÙNG một tệp GeoJSON đóng băng: không gọi mạng, chạy
   được khi ngắt mạng, không tốn tiền. Chúng chỉ khác nhau ở cách tô.

   Ba cái sau là ảnh ô (raster tile) lấy từ máy chủ ngoài: nhiều chi tiết hơn
   hẳn — có nhãn đường, tên địa danh, ảnh vệ tinh — nhưng CẦN MẠNG và mỗi
   nguồn có yêu cầu ghi công riêng, bắt buộc hiển thị.

   Mặc định là nền ngoại tuyến. Không tự ý gọi ra ngoài khi chưa ai chọn.
   ========================================================================= */
export const BASEMAPS = {
  'osm-neutral': {
    label: 'Trung tính', kind: 'local', note: 'Không cần mạng · tông xanh nhạt',
  },
  'osm-contrast': {
    label: 'Tương phản cao', kind: 'local', note: 'Không cần mạng · đường và khối nhà rõ hơn',
    tune: { earth: '#CBD6CC', building: '#B4C2B7', buildingLine: '#9BAC9F',
      green: '#B4CDB6', water: '#9CBCD0', casing: '#A6B6AB' },
  },
  'osm-mono': {
    label: 'Đơn sắc', kind: 'local', note: 'Không cần mạng · hợp để in đen trắng',
    tune: { earth: '#E2E2E2', green: '#D6D6D6', water: '#C4C4C4', road: '#FFFFFF',
      casing: '#BDBDBD', building: '#CFCFCF', buildingLine: '#B5B5B5', metro: '#4A4A4A' },
  },
  /* Nền "phố có nhãn" KHÔNG dùng CARTO nữa.

     CARTO đã chuyển raster tile sang bắt buộc khoá API và đang khai tử dòng
     này. Hậu quả quan sát được trước khi sửa: toàn bộ bản đồ bị lát chữ
     "API KEY REQUIRED", tức bề mặt chính của sản phẩm hỏng hoàn toàn mà
     không có lỗi console nào báo.

     Thay bằng máy chủ ô chuẩn của OpenStreetMap: không khoá, không tài
     khoản. Đổi lại phải tôn trọng chính sách dùng ô của OSM — chỉ hợp cho
     lưu lượng thấp như bản đánh giá này, và BẮT BUỘC ghi công.

     Nâng cấp về sau nếu cần chất lượng cao hơn: OpenFreeMap
     (tiles.openfreemap.org) cho ô vector không khoá và không giới hạn,
     nhưng nó thay TOÀN BỘ style nên phải viết đường gộp lớp riêng. */
  'osm-standard': {
    label: 'Phố có nhãn', kind: 'raster',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© những người đóng góp OpenStreetMap',
    maxzoom: 19,
    note: 'Cần mạng · có tên đường và địa danh',
  },
  /* NỀN VECTOR OPENFREEMAP — nguồn mở, không khoá, không giới hạn.

     Khác hai loại trên ở chỗ nó thay TOÀN BỘ kiểu bản đồ: ô vector kèm
     glyphs và sprite riêng, nên có nhãn đường, tên địa danh và nhãn ở
     mọi mức phóng — thứ mà nền GeoJSON cục bộ không thể có vì không có
     endpoint glyphs.

     Dữ liệu: OpenStreetMap qua OpenMapTiles. Không tài khoản, không khoá
     API, không giới hạn lượt xem — đây là lý do chọn nó thay vì CARTO
     (đã bắt buộc khoá) hay MapTiler/Stadia (đòi đăng ký).

     Đánh đổi: CẦN MẠNG, và kiểu của họ đậm màu hơn nền cục bộ nên 407
     chấm dữ liệu phải cạnh tranh với nhiều chi tiết hơn.              */
  'openfreemap-liberty': {
    label: 'Vector chi tiết', kind: 'vector',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap © OpenMapTiles · dữ liệu © những người đóng góp OpenStreetMap',
    note: 'Cần mạng · đầy đủ tên đường, khối nhà 3D',
  },
  /* NỀN GOOGLE (QĐ 187, 188): toạ độ đúng ghim lấy từ Google chỉ được hiện trên bản đồ Google. Map Tiles API cho ô nền 2D
     dùng ngay trong MapLibre, nên giao diện giữ nguyên, chỉ đổi lớp nền. Ô cần một phiên (createSession) và khoá; khoá đọc
     từ config.khoa.js (git bỏ qua). Không phải nền mặc định: chỉ bật khi người dùng chọn. */
  'google-roadmap': {
    label: 'Google Maps', kind: 'raster', google: true,
    tiles: [],
    attribution: 'Dữ liệu bản đồ © Google',
    maxzoom: 20,
    note: 'Cần mạng · nền Google Maps · chấm viền xanh là tòa trên trang rao (giá chào)',
  },
  'esri-satellite': {
    label: 'Ảnh vệ tinh', kind: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Ảnh vệ tinh © Esri, Maxar, Earthstar Geographics',
    maxzoom: 18,
    note: 'Cần mạng · ảnh vệ tinh',
  },
};
/* MẶC ĐỊNH LÀ NỀN CỤC BỘ, không phải nền gọi mạng.

   Ba lý do, theo thứ tự quan trọng:
   1. Nền ngoài có thể chết bất cứ lúc nào mà không báo — CARTO vừa chứng
      minh đúng điều đó và làm hỏng bề mặt chính của sản phẩm.
   2. Trang phải mở được khi ngắt mạng và không tự gọi ra ngoài khi chưa ai
      yêu cầu.
   3. Nền cục bộ dùng đúng bảng màu của giao diện nên 407 điểm dữ liệu nổi
      lên trên nó; nền phố nhiều chi tiết thì điểm dữ liệu chìm vào nhiễu.

   Nền phố có nhãn và ảnh vệ tinh vẫn còn trong bộ chọn — chỉ là phải bấm. */
/* Mặc định là NỀN VECTOR OPENFREEMAP theo yêu cầu người dùng.

   Đánh đổi phải nói rõ: nền này CẦN MẠNG, nên trang không còn mở được khi
   ngắt mạng như trước. Đổi lại nó có nhãn đường, tên địa danh, số hiệu
   quốc lộ và khối nhà 3D — thứ nền GeoJSON cục bộ không thể có.

   Nền cục bộ vẫn là ĐƯỜNG LUI: nếu tải kiểu vector hỏng thì `init()` rơi
   về `osm-neutral` thay vì để bản đồ trắng. Nó cũng vẫn nằm trong bộ chọn.

   Không cần khoá API, không giới hạn lượt xem — nếu không thì không được
   đặt làm mặc định. */
export const BASEMAP_DEFAULT = 'openfreemap-liberty';

/* Phiên Map Tiles API: tạo một lần, rồi mỗi ô nền là /v1/2dtiles/{z}/{x}/{y}?session=…&key=…
   Phiên sống khoảng hai tuần; mở lại trang là tạo phiên mới. */
async function ganPhienGoogle(base) {
  const { GOOGLE_MAPS_API_KEY: k } = await import('../config.khoa.js');
  if (!k) throw new Error('thiếu khoá trong config.khoa.js');
  const r = await fetch('https://tile.googleapis.com/v1/createSession?key=' + encodeURIComponent(k), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType: 'roadmap', language: 'vi-VN', region: 'VN' }),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const { session } = await r.json();
  base.tiles = [`https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${session}&key=${encodeURIComponent(k)}`];
}
export const BASEMAP_FALLBACK = 'osm-neutral';

/* Thang màu giá dùng chung với trang Tổng quan và chú giải. Giữ nguyên cặp
   --rN / --on-rN — hai token này đã được đo tương phản THEO CẶP, tách ra là
   mất bảo đảm WCAG. */
const RENT_RAMP = ['--r0', '--r1', '--r2', '--r3', '--r4'];
const RENT_ONRAMP = ['--on-r0', '--on-r1', '--on-r2', '--on-r3', '--on-r4'];

/* Tên năm bậc. Con số "7,9" một mình không cho biết rẻ hay đắt; tên bậc thì
   cho biết ngay. Dùng CHUNG giữa bản đồ, danh sách và chú giải. */
/* 01/10 chủ dự án hỏi "đắt nhất mà sao có cả chục tòa": nhãn cũ "đắt nhất"/"rẻ nhất" đọc như bậc nhất, trong khi đó là
   NHÓM 20%. Nay ghi rõ "20% ...". */
export const RENT_BANDS = [
  { key: 0, label: 'nhóm 20% rẻ nhất', short: '20% rẻ nhất' },
  { key: 1, label: 'nhóm 20% giá thấp', short: 'giá thấp' },
  { key: 2, label: 'nhóm 20% giá giữa', short: 'giá giữa' },
  { key: 3, label: 'nhóm 20% giá cao', short: 'giá cao' },
  { key: 4, label: 'nhóm 20% đắt nhất', short: '20% đắt nhất' },
];

/* THANG NGŨ PHÂN VỊ — hàm thuần, DÙNG CHUNG cho bản đồ và danh sách.

   Vì sao phải dùng chung: nếu hai bề mặt tự tính thang riêng thì cùng một
   tòa nhà có thể mang màu bậc 3 trên bản đồ và bậc 2 trong danh sách. Người
   dùng đối chiếu hai bên sẽ thấy sản phẩm tự mâu thuẫn.

   Ngũ phân vị chứ không chia đều biên độ: giá lệch phải mạnh (p90 = 38 trong
   khi max = 70), chia đều biên độ sẽ dồn ~90% số tòa vào hai bậc nhạt nhất
   và cả bản đồ lẫn danh sách lại thành một màu. */
export function rentScaleOf(list) {
  const vals = list.filter((b) => isPresent(b.baseRent)).map((b) => b.baseRent.value)
    .sort((a, b) => a - b);
  if (!vals.length) return null;
  const at = (t) => vals[Math.min(vals.length - 1, Math.floor(t * vals.length))];
  const cuts = [at(0.2), at(0.4), at(0.6), at(0.8)];
  return {
    min: vals[0], max: vals[vals.length - 1], cuts, n: vals.length,
    bucket: (v) => {
      if (v == null || !Number.isFinite(v)) return -1;
      let k = 0;
      while (k < 4 && v >= cuts[k]) k++;
      return k;
    },
    /* Vị trí phần trăm trong tập đang hiện — "rẻ hơn 96% số tòa" là khung
       quy chiếu mà con số trần không có. */
    pctBelow: (v) => {          // % số tòa có giá THẤP HƠN v (tức tòa này đắt hơn chừng ấy %)
      if (v == null || !Number.isFinite(v)) return null;
      let i = 0;
      while (i < vals.length && vals[i] < v) i++;
      return Math.floor((i / vals.length) * 100);   // làm tròn XUỐNG: 406/407 không được thành '100%'
    },
    pctAbove: (v) => {          // % số tòa có giá CAO HƠN v (tức tòa này rẻ hơn chừng ấy %)
      if (v == null || !Number.isFinite(v)) return null;
      return Math.floor((vals.filter((x) => x > v).length / vals.length) * 100);
    },
  };
}

const M_PER_DEG_LAT = 110574;
const mPerDegLng = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/** Vòng tròn bán kính đường thẳng — làm HIỆN định nghĩa khoảng cách. */
function circle(lat, lng, radiusM, sides = 96) {
  const ring = [];
  for (let i = 0; i <= sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([
      lng + (Math.cos(a) * radiusM) / mPerDegLng(lat),
      lat + (Math.sin(a) * radiusM) / M_PER_DEG_LAT,
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

const empty = () => ({ type: 'FeatureCollection', features: [] });

/** Nhân sáng một màu hex (k < 1 = tối đi). Trả lại nguyên màu nếu không phải
    hex — MapLibre chỉ nhận màu tường minh, nên không đoán bừa. */
function shade(hex, k) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export class PilotMap {
  constructor(container, { onSelect, onHover, onCluster, onAmenityHover, onScaleChange, reducedMotion, theme } = {}) {
    this.container = container;
    this.onSelect = onSelect || (() => {});
    this.onHover = onHover || (() => {});
    // Rê chuột trên bản đồ phải làm sáng đúng dòng trong danh sách xếp hạng,
    // và ngược lại. Liên kết hai chiều là thứ bản trước thiếu hẳn.
    // Bấm vào một cụm: trả về danh sách id bên trong để giao diện mở bảng
    // chọn, thay vì im lặng phóng to.
    this.onCluster = onCluster || (() => {});
    /* Mặc định KHÔNG vẽ tuyến nào. Bài học từ bản trước: vẽ cả 48 tuyến
       cùng lúc là một mớ chỉ rối, và người dùng đã nói đúng điều đó. Chế độ
       'off' trong _routeOpacity() vẽ ĐÚNG tuyến đang được trỏ tới — không
       phải tắt hẳn tính năng, mà là chỉ hiện thứ đang được hỏi. */
    this.routeMode = 'off';
    this.onAmenityHover = onAmenityHover || (() => {});
    // Chú giải giá phải đi theo thang, mà thang tính trên tập ĐANG HIỆN.
    this.onScaleChange = onScaleChange || (() => {});
    this.reducedMotion = reducedMotion || (() => false);
    this.theme = theme || (() => 'light');
    /* KHUNG NHÌN THẬT ≠ KHUNG VẼ.

       Bản đồ trải hết ô chứa, nhưng một phần bị bảng thông tin che. Bản
       trước không biết điều đó nên mọi lệnh camera đều căn theo TÂM Ô VẼ —
       và tòa nhà đang chọn cùng các tuyến đi bộ của nó rơi thẳng xuống dưới
       bảng. Đây là gốc của "bảng che gần hết tuyến đường đi": không phải
       bảng quá to, mà camera không biết bảng tồn tại.

       `map.setPadding()` dời tâm hình học của camera vào giữa phần CÒN
       THẤY ĐƯỢC. Đo được: đặt padding trái 400px trên khung 1176px thì
       flyTo(center) đặt điểm đó ở x=788 — đúng 400 + (1176−400)/2.
       Mọi lệnh fitBounds sau đó chỉ cần thêm lề nhỏ, vì padding của khung
       nhìn được CỘNG vào lề của fitBounds. */
    this.pad = { top: 0, right: 0, bottom: 0, left: 0 };
    this.markers = new Map();
    this.buildings = [];
    this.visibleIds = new Set();
    this.selectedId = null;
    this.compareIds = new Set();
    this.popup = null;
    this.ready = false;
    this.basemapId = BASEMAP_DEFAULT;
    // Bật khối nhà 3D theo mặc định khi nền là vector — đó là lý do chính
    // để dùng nền vector, nên không bắt người dùng đi tìm công tắc.
    this.pitched = true;
  }

  async init(buildings, metroStations) {
    // Bảy hồ sơ kiểm tra thủ công chưa có tọa độ vẫn nằm trong danh sách và
    // hồ sơ, nhưng không được phép sinh marker giả trên bản đồ.
    this.buildings = buildings.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));
    /* Phiên bản đầy đủ: QĐ 194 (02/10, chủ dự án chọn): dùng đúng toạ độ ghim đã thu, trên nền mặc định như bản 407 (không khoá
       Google), cả trên trang công khai. Bản 01/10 ép nền Google và bỏ chấm khi không có phiên Google; nay bỏ ràng buộc ấy. */
    const [ml, basemap] = await Promise.all([
      import('../vendor/maplibre/maplibre-gl.mjs'),
      fetch(BASEMAP_URL).then((r) => r.json()),
    ]);
    this._ml = ml;
    this.basemap = basemap;
    this.stations = metroStations;

    /* Kiểu vector phải tải xong TRƯỚC khi dựng bản đồ. Dựng trước rồi đổi
       sau sẽ nháy một lần nền cục bộ rồi mới sang vector — vừa xấu vừa tốn
       một lần dựng lại toàn bộ lớp phủ.
       Hỏng thì rơi về nền cục bộ và NÓI RA, không để bản đồ trắng. */
    const wantVec = BASEMAPS[this.basemapId]?.kind === 'vector';
    if (wantVec) {
      try {
        const r = await fetch(BASEMAPS[this.basemapId].styleUrl);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this._vecStyle = await r.json();
      } catch (err) {
        this.basemapId = BASEMAP_FALLBACK;
        this.vecFailed = err.message;
      }
    }

    this.map = new ml.Map({
      container: this.container,
      style: this._style(),
      center: [106.7035, 10.7745],
      zoom: 12.4,
      // Nghiêng sẵn khi nền vector: khối nhà 3D chỉ có nghĩa khi nhìn chéo.
      pitch: this._vecStyle && this.pitched ? 50 : 0,
      bearing: this._vecStyle && this.pitched ? -18 : 0,
      maxZoom: 17.5,
      minZoom: 9.5,
      attributionControl: false,
      keyboard: true,
      // Cho xoay và nghiêng khi có nền vector — không có hai thao tác này
      // thì 3D chỉ là một góc nhìn cố định, không phải thứ khám phá được.
      pitchWithRotate: !!this._vecStyle,
      dragRotate: !!this._vecStyle,
    });

    this.map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    this.map.addControl(new ml.ScaleControl({ maxWidth: 96, unit: 'metric' }), 'bottom-left');
    this.map.addControl(new ml.AttributionControl({
      compact: false,
      customAttribution: 'Nền bản đồ © những người đóng góp OpenStreetMap (ODbL) · trích xuất 24/08/2026',
    }), 'bottom-right');

    await new Promise((res) => this.map.on('load', res));
    // Ảnh biểu tượng phải có TRƯỚC khi bất kỳ lớp symbol nào được bật.
    this._addBusIcon();

    const canvas = this.map.getCanvas();
    canvas.setAttribute('tabindex', '0');
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label',
      `Bản đồ ${this.buildings.length} tòa nhà. Phím mũi tên để di chuyển, phím cộng và trừ để phóng to thu nhỏ. `
      + 'Danh sách bên trái có cùng dữ liệu và bộ lọc.');

    // Bấm ra nền chỉ đóng popup; lựa chọn tòa nhà vẫn giữ nguyên.
    this.map.on('click', (e) => {
      if (e.originalEvent.target.closest('.mk') || e.originalEvent.target.closest('.amk')) return;
      this.closePopup();
    });

    // Tính lại chỗ đặt nhãn khi khung nhìn đứng yên. Không chạy trong lúc
    // đang kéo: đo hình hộp hàng chục lần mỗi khung hình sẽ giật.
    const replace = () => { this._rebuildMarkers(); this._placeLabels(); this._zoomTransit();
      this._paintSelectedFootprint(); };
    this.map.on('moveend', replace);
    /* `moveend` bắn lúc camera dừng — ô bản đồ vector thường về SAU đó, nên
       truy vấn mặt bằng ở thời điểm ấy hay trả rỗng.

       KHÔNG dùng `idle`: hoạt ảnh nét đứt của tuyến đi bộ gọi
       setPaintProperty liên tục, nên bản đồ không bao giờ rảnh và `idle`
       không bao giờ bắn — đo được đúng như vậy, mặt bằng chỉ tô lên khi có
       một thao tác di chuyển KHÁC xảy ra sau đó.

       Bám `sourcedata` của chính nguồn vector thì đúng thời điểm: ô vừa nạp
       xong là truy vấn được ngay. Gộp trễ 60 ms vì một lần di chuyển làm
       hàng chục ô về gần như cùng lúc. */
    this.map.on('sourcedata', (e) => {
      if (e.sourceId !== 'openmaptiles' || !e.isSourceLoaded) return;
      clearTimeout(this._fpTimer);
      this._fpTimer = setTimeout(() => this._paintSelectedFootprint(), 60);
    });
    this.map.on('zoomend', replace);
    this.map.on('resize', replace);

    this.setBuildings(this.buildings.map((b) => b.id));
    this.ready = true;
    return this;
  }

  /** Đọc màu bản đồ từ token CSS đang có hiệu lực. Trả về đối tượng chỉ
      chứa những token thực sự được khai báo — token trống thì để hằng số JS
      lo, nên thêm giao diện mới không bắt buộc phải khai đủ mọi màu. */
  _cssColors() {
    const cs = getComputedStyle(document.documentElement);
    const pick = (name) => {
      const v = cs.getPropertyValue(name).trim();
      return v || null;
    };
    const map = {
      earth: '--map-earth', green: '--map-green', water: '--map-water',
      road: '--map-road', casing: '--map-road-casing', building: '--map-building',
      metro: '--map-metro', ring: '--map-ring',
      pin: '--map-pin', station: '--map-road',
    };
    const out = {};
    for (const [k, token] of Object.entries(map)) {
      const v = pick(token);
      if (v) out[k] = v;
    }
    // Đường viền khối nhà không có token riêng: tối hơn chính khối nhà một
    // bậc, để mọi giao diện tự có viền hợp tông.
    //
    // Tính bằng SỐ, không dùng color-mix(): bộ kiểm tra kiểu của MapLibre chỉ
    // nhận màu tường minh và từ chối color-mix — mà từ chối một thuộc tính là
    // hỏng CẢ kiểu, bản đồ không vẽ được gì.
    if (out.building) out.buildingLine = shade(out.building, 0.82);
    // Viền đường đi bộ = nền bản đồ, để đường nổi lên khỏi nền.
    if (out.earth) out.routeCasing = out.earth;
    return out;
  }

  /* --- Kiểu nền, dựng lại được khi đổi chế độ sáng/tối hoặc đổi nền ------ */
  _style() {
    const base = BASEMAPS[this.basemapId] || BASEMAPS[BASEMAP_DEFAULT];
    const raster = base.kind === 'raster';
    // Kiểu vector ngoài chỉ dùng được khi ĐÃ tải xong; chưa có thì rơi về
    // nền cục bộ thay vì dựng một kiểu rỗng.
    const vec = base.kind === 'vector' ? this._vecStyle : null;
    /* Ảnh vệ tinh cần quầng tối dưới mọi đường; nền vẽ thì không.
       'sat' bật thêm lớp viền và nâng độ mờ, KHÔNG làm dày đường lên. */
    const sat = base.id === 'esri-satellite' || raster;
    const halo = 'rgba(8,14,12,0.72)';   // quầng tối, dùng chung cho mọi đường
    // Bảng màu: bắt đầu từ hằng số JS, rồi ĐẮP ĐÈ bằng token CSS đang có
    // hiệu lực, rồi mới tới tinh chỉnh của nền.
    //
    // Vì sao phải đọc từ CSS: giao diện (skin) định nghĩa lại token màu bản
    // đồ trong CSS. Nếu bản đồ chỉ đọc hằng số JS thì đổi giao diện sẽ đổi
    // cả trang trừ bản đồ — hai nguồn sự thật, và bản đồ luôn là cái sai.
    const c = { ...(PALETTE[this.theme()] || PALETTE.light), ...this._cssColors(), ...(base.tune || {}) };
    // Giữ lại để _addBusIcon vẽ biểu tượng đúng tông của nền đang dùng.
    this._c = c;
    const bm = this.basemap;
    // Lớp giao thông có thể chưa nạp xong khi kiểu bản đồ dựng lần đầu —
    // nguồn rỗng thì lớp vẫn tạo được, và setTransitData() sẽ đắp dữ liệu vào.
    const tx = this.transitData?.layers || {};
    const ar = this.areaData?.layers || {};

    // Lớp phủ của SẢN PHẨM — vòng bán kính, isochrone, đường đi bộ, metro —
    // luôn nằm trên, dù nền là gì. Chúng là dữ liệu, không phải trang trí.
    const localSources = {
      water: { type: 'geojson', data: bm.layers.water },
      green: { type: 'geojson', data: bm.layers.green },
      buildings: { type: 'geojson', data: bm.layers.buildings || empty() },
      roadsMinor: { type: 'geojson', data: bm.layers.roads_minor },
      roadsMid: { type: 'geojson', data: bm.layers.roads_mid || empty() },
      roadsMajor: { type: 'geojson', data: bm.layers.roads_major },
    };
    const rasterSource = {
      basetiles: {
        type: 'raster',
        tiles: base.tiles,
        tileSize: 256,
        maxzoom: base.maxzoom || 19,
        attribution: base.attribution,
      },
    };

    return {
      version: 8,
      // Kiểu vector mang glyphs và sprite riêng — đó là thứ cho phép nhãn chữ.
      ...(vec ? { glyphs: vec.glyphs, sprite: vec.sprite } : {}),
      sources: {
        ...(vec ? vec.sources : raster ? rasterSource : localSources),
        metro: { type: 'geojson', data: bm.layers.metro_l1 },
        metroFuture: { type: 'geojson', data: tx.metro_future || empty() },
        railLine: { type: 'geojson', data: tx.rail_national || empty() },
        busStops: { type: 'geojson', data: tx.bus_stops || empty() },
        wards: { type: 'geojson', data: ar.wards || empty() },
        cbd: { type: 'geojson', data: this._cbdGeo() },
        stations: { type: 'geojson', data: stationsGeoJson(this.stations) },
        rings: { type: 'geojson', data: this.selectedId ? this._ringsFor(this.selectedId) : empty() },
        /* Mặt bằng tòa đang xem giữ trong nguồn GeoJSON RIÊNG, không lọc
           thẳng trên nguồn vector. Lý do ở _paintSelectedFootprint. */
        selFootprint: { type: 'geojson', data: empty() },
        isochrones: { type: 'geojson', data: empty() },
        walkRoutes: { type: 'geojson', data: empty(), promoteId: 'rid' },
      },
      layers: vec ? [
        // Lớp nền của họ giữ NGUYÊN, lớp phủ của sản phẩm chồng lên trên.
        ...vec.layers,
        /* KHỐI NHÀ 3D. OpenFreeMap dùng lược đồ OpenMapTiles nên nguồn
           `openmaptiles`, source-layer `building`, đã mang sẵn
           `render_height` và `render_min_height` — không phải suy ra hay
           bịa chiều cao từ số tầng.

           Nhà nào KHÔNG có chiều cao trong OSM thì lấy 3 m: đủ để thấy có
           công trình ở đó, và thấp hẳn so với nhà có số thật nên không
           trông như một tuyên bố về độ cao.

           minzoom 14: dưới mức đó khối nhà chỉ là nhiễu và tốn GPU. */
        ...(this.pitched ? [{
          id: 'b3d', type: 'fill-extrusion', source: 'openmaptiles',
          'source-layer': 'building', minzoom: 14,
          paint: {
            'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'render_height'],
              0, c.building, 30, shade(c.building, 0.94), 120, shade(c.building, 0.82)],
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 3],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, 0.82],
          },
        }] : []),

        /* -------------------------------------------------------------
           TÔ NỀN TÒA ĐANG XEM

           Chấm đánh dấu nói "quanh đây", mặt bằng nhà nói "chính chỗ này".
           Ở mức phóng gần, chấm nằm đè lên cả một dãy nhà và người xem
           vẫn phải đoán tòa nào — tô chính khối nhà thì hết đoán.

           GIỚI HẠN PHẢI NÓI RA: đây là mặt bằng nhà của OpenStreetMap
           nằm DƯỚI tọa độ hồ sơ, không phải một liên kết đã kiểm chứng
           giữa hồ sơ và OSM. Vì vậy chỉ tô khi tọa độ rơi HẲN vào trong
           một mặt bằng — không rơi trúng thì không tô gì, thà không tô
           còn hơn tô nhầm tòa bên cạnh.

           `b-sel-hit` trong suốt, chỉ để dò trúng — MapLibre chỉ truy
           vấn được lớp thật sự đang vẽ. */
        { id: 'b-sel-hit', type: 'fill', source: 'openmaptiles',
          'source-layer': 'building', minzoom: 15,
          paint: { 'fill-opacity': 0 } },
        { id: 'b-sel-fill', type: 'fill', source: 'selFootprint',
          paint: { 'fill-color': '#F0682A', 'fill-opacity': sat ? 0.5 : 0.34 } },
        { id: 'b-sel-line', type: 'line', source: 'selFootprint',
          paint: { 'line-color': '#F0682A', 'line-width': 2.2, 'line-opacity': 0.95 } },
        ...(this.pitched ? [{
          id: 'b-sel-3d', type: 'fill-extrusion', source: 'selFootprint',
          paint: {
            'fill-extrusion-color': '#F0682A',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 3],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.75,
          },
        }] : []),
        ...this._overlayLayers(c, sat, halo),
      ] : raster ? [
        { id: 'bg', type: 'background', paint: { 'background-color': c.earth } },
        { id: 'basetiles', type: 'raster', source: 'basetiles', paint: { 'raster-opacity': 1 } },
        ...this._overlayLayers(c, sat, halo),
      ] : [
        { id: 'bg', type: 'background', paint: { 'background-color': c.earth } },
        { id: 'green', type: 'fill', source: 'green', paint: { 'fill-color': c.green } },
        { id: 'water', type: 'fill', source: 'water', paint: { 'fill-color': c.water } },
        // Khối nhà: kết cấu đô thị, KHÔNG phải tuyên bố về 12 tòa pilot.
        // Đây là lớp làm bản đồ đọc được — bản trước thiếu hẳn nên trống trải.
        {
          id: 'buildings', type: 'fill', source: 'buildings', minzoom: 14,
          paint: {
            'fill-color': c.building,
            'fill-outline-color': c.buildingLine,
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, 1],
          },
        },
        {
          id: 'roads-minor-casing', type: 'line', source: 'roadsMinor', minzoom: 13,
          paint: { 'line-color': c.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 15, 3, 17, 7.5] },
        },
        {
          id: 'roads-minor', type: 'line', source: 'roadsMinor', minzoom: 13,
          paint: { 'line-color': c.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 15, 1.8, 17, 5.4] },
        },
        {
          id: 'roads-mid-casing', type: 'line', source: 'roadsMid',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 14, 3.6, 17, 9] },
        },
        {
          id: 'roads-mid', type: 'line', source: 'roadsMid',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 14, 2.2, 17, 6.4] },
        },
        {
          id: 'roads-major-casing', type: 'line', source: 'roadsMajor',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 4.6, 17, 11.5] },
        },
        {
          id: 'roads-major', type: 'line', source: 'roadsMajor',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.9, 14, 3, 17, 9] },
        },
        ...this._overlayLayers(c, sat, halo),
      ],
    };
  }

  /** Lớp phủ của SẢN PHẨM: vòng bán kính, isochrone, metro, đường đi bộ.
      Luôn nằm trên nền, dù nền là GeoJSON cục bộ hay ảnh ô từ máy chủ ngoài —
      đây là dữ liệu của bản thử, không phải trang trí của nền. */
  /* sat/halo truyền vào chứ không đọc lại từ this: hai lời gọi ở trên nằm
     trong _style(), nơi đã tính sẵn chúng từ nền đang chọn. Đọc lại ở đây sẽ
     thành hai nguồn sự thật cho cùng một câu hỏi "nền có phải ảnh không". */
  _overlayLayers(c, sat, halo) {
    return [
        // Vòng bán kính đường thẳng quanh tòa đang chọn
        /* Isochrone đi bộ — vùng THỰC SỰ đi tới được, bám mạng đường thật.
           Vẽ dưới vòng tròn bán kính để đặt cạnh nhau thấy ngay vòng tròn
           nói dối tới đâu: nó băng qua sông, isochrone thì không. */
        {
          id: 'iso-fill', type: 'fill', source: 'isochrones',
          paint: {
            'fill-color': ['match', ['get', 'min'],
              5, c.iso[0], 10, c.iso[1], 15, c.iso[2], c.iso[2]],
            'fill-opacity': ['match', ['get', 'min'], 5, 0.16, 10, 0.11, 15, 0.07, 0.07],
          },
        },
        {
          id: 'iso-halo', type: 'line', source: 'isochrones',
          layout: { 'line-cap': 'round', 'line-join': 'round', visibility: sat ? 'visible' : 'none' },
          paint: {
            'line-color': halo,
            'line-width': ['match', ['get', 'min'], 5, 4.6, 10, 4.2, 15, 3.9, 3.9],
            'line-opacity': 0.9,
          },
        },
        {
          id: 'iso-line', type: 'line', source: 'isochrones',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['match', ['get', 'min'],
              5, c.iso[0], 10, c.iso[1], 15, c.iso[2], c.iso[2]],
            'line-width': ['match', ['get', 'min'], 5, 1.9, 10, 1.5, 15, 1.2, 1.2],
            'line-opacity': sat ? 1 : 0.85,
          },
        },
        { id: 'rings-fill', type: 'fill', source: 'rings', paint: { 'fill-color': c.ring, 'fill-opacity': sat ? 0.06 : 0.035 } },
        {
          id: 'rings-halo', type: 'line', source: 'rings',
          layout: { visibility: sat ? 'visible' : 'none' },
          paint: { 'line-color': halo, 'line-opacity': 0.8, 'line-width': 3.2, 'line-dasharray': [1.1, 1.1] },
        },
        {
          // Trên ảnh vệ tinh vòng đổi sang TRẮNG: mực xám của giao diện chìm
          // vào mái nhà và mặt đường, còn trắng thì không trùng với gì cả.
          id: 'rings-line', type: 'line', source: 'rings',
          paint: {
            'line-color': sat ? '#FFFFFF' : c.ring,
            'line-opacity': sat ? 0.92 : 0.32,
            'line-width': 1.2, 'line-dasharray': [3, 3],
          },
        },
        /* ---- RANH GIỚI PHƯỜNG ----------------------------------------
           Bối cảnh, không phải nội dung — nên vẽ TRƯỚC mọi lớp khác và chỉ có
           viền. Tô đặc toàn bộ đa giác trong bbox lên ảnh vệ tinh sẽ che mất đúng cái ảnh mà
           người dùng bật lên để đối chiếu.

           TP.HCM KHÔNG CÒN CẤP QUẬN (đợt sắp xếp đơn vị hành chính) — cấp duy
           nhất dưới thành phố là phường. Trường district trong payload
           ("quan-1"…) là nhãn lịch sử, không phải ranh giới đang có hiệu lực,
           nên không được vẽ như ranh giới.                                */
        {
          id: 'ward-fill', type: 'fill', source: 'wards',
          layout: { visibility: 'none' },
          paint: {
            'fill-color': sat ? '#FFFFFF' : c.ring,
            // Chỉ phường CÓ tòa được tô, và tô rất nhạt.
            'fill-opacity': ['case', ['boolean', ['get', 'hasBuildings'], false], sat ? 0.10 : 0.06, 0],
          },
        },
        {
          id: 'ward-line', type: 'line', source: 'wards',
          layout: { visibility: 'none', 'line-join': 'round' },
          paint: {
            'line-color': sat ? '#FFFFFF' : c.ring,
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, sat ? 0.42 : 0.30, 15, sat ? 0.72 : 0.46],
            'line-width': ['case', ['boolean', ['get', 'hasBuildings'], false], 1.8, 0.9],
            'line-dasharray': [4, 2.5],
          },
        },
        /* ---- LỚP GIAO THÔNG ------------------------------------------
           Bản trước chỉ có Metro số 1: một vệt xanh chạy chéo qua khung, không
           nối vào gì cả. Một tuyến đơn độc không trả lời được "chỗ này đi lại
           thế nào", vì nó bỏ trống mọi phương tiện thật sự chở người đi làm.

           Thứ tự vẽ mang nghĩa: xe buýt (nền, dày đặc) → đường sắt quốc gia →
           metro ĐANG XÂY → metro ĐANG CHẠY. Cái đang chạy luôn nằm trên cùng
           vì nó là thứ dùng được hôm nay.                                  */

        // Điểm dừng xe buýt: 2.156 chấm. Đây là lớp NỀN, trả lời một câu duy
        // nhất ở mức nhìn tổng thể — khu này mạng xe buýt dày hay thưa. Vẽ
        // bằng lớp circle chứ không phải marker DOM: 2.156 phần tử DOM sẽ
        // giết hiệu năng, và không cái nào trong số đó cần bấm vào.
        {
          id: 'bus-stops', type: 'circle', source: 'busStops',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 1.1, 15, 2.4, 17, 3.6],
            'circle-color': sat ? '#EAF0EC' : c.bus,
            // Chấm nhường chỗ cho biểu tượng ở dải 15,0–15,8: hai lớp giao
            // nhau mềm nên mắt không thấy một cú nhảy.
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 12, sat ? 0.7 : 0.45, 15, sat ? 0.95 : 0.8, 15.8, 0],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, sat ? 0.8 : 0, 16, sat ? 1.4 : 1],
            'circle-stroke-color': sat ? halo : c.earth,
          },
        },
        {
          id: 'bus-icons', type: 'symbol', source: 'busStops',
          minzoom: 15,
          layout: {
            visibility: 'none',
            'icon-image': 'bus-pin',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 15, 0.62, 17, 1],
            'icon-allow-overlap': false,
            'icon-ignore-placement': false,
          },
          paint: {
            'icon-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.8, 1],
          },
        },
        // Đường sắt Bắc – Nam: nét kép đen-trắng, đúng quy ước bản đồ đường sắt
        {
          id: 'rail-base', type: 'line', source: 'railLine',
          layout: { visibility: 'none', 'line-cap': 'butt', 'line-join': 'round' },
          paint: {
            // c.rail (#6B7A72) quá nhạt — cùng lỗi đã gặp với chấm xe buýt.
            // Đường sắt là hạ tầng lớn, nó phải đọc được ở mức nhìn tổng thể.
            'line-color': sat ? '#12181A' : '#3A4642',
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, sat ? 2.4 : 2.4, 16, sat ? 5.2 : 5.4],
          },
        },
        {
          id: 'rail-hatch', type: 'line', source: 'railLine',
          layout: { visibility: 'none', 'line-cap': 'butt', 'line-join': 'round' },
          paint: {
            'line-color': sat ? '#FFFFFF' : c.earth,
            'line-width': ['interpolate', ['linear'], ['zoom'], 11, sat ? 1.2 : 0.8, 16, sat ? 2.6 : 2],
            'line-dasharray': [2.5, 2.5],
          },
        },
        /* Metro số 2 — ĐANG XÂY DỰNG.

           Cùng màu với tuyến đang chạy vì cùng một hệ thống, nhưng NÉT ĐỨT và
           mảnh hơn: người đọc phải phân biệt được ngay "đi được hôm nay" với
           "sẽ đi được". Vẽ đặc như tuyến đang chạy là nói dối bằng hình.

           OSM có hình học tuyến nhưng KHÔNG có nút ga nào — nên tuyến này
           không có chấm ga. Vẽ ga ở đây sẽ là bịa toạ độ. Chú giải nói rõ. */
        {
          id: 'metro2-halo', type: 'line', source: 'metroFuture',
          layout: { visibility: 'none', 'line-cap': 'butt', 'line-join': 'round' },
          paint: {
            'line-color': halo,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.4, 15, 6],
            'line-opacity': sat ? 0.85 : 0,
          },
        },
        {
          /* Metro 2 giữ NÉT ĐỨT (đang xây) nhưng đổi màu để không lẫn với
             tuyến 1: tím-lam thay vì lam. Cùng hệ thống, khác trạng thái —
             và người dùng phải phân biệt được ngay cái nào đi được hôm nay. */
          id: 'metro2-line', type: 'line', source: 'metroFuture',
          layout: { visibility: 'none', 'line-cap': 'butt', 'line-join': 'round' },
          paint: {
            'line-color': c.metro2,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 15, 3.4],
            'line-dasharray': [3, 2.5],
            'line-opacity': sat ? 1 : 0.8,
          },
        },
        // Tuyến Metro số 1 — hình học tuyến thật, OSM relation 11919223
        {
          id: 'metro-casing', type: 'line', source: 'metro',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': sat ? halo : c.earth,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3.4, 15, 8],
          },
        },
        {
          id: 'metro-line', type: 'line', source: 'metro',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': c.metro, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 15, 4] },
        },
        {
          id: 'stations', type: 'circle', source: 'stations',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 15, 4.5],
            'circle-color': c.station, 'circle-stroke-color': c.metro, 'circle-stroke-width': 1.6,
          },
        },
        // Đường đi bộ thật tới tiện ích, tính bằng Dijkstra trên mạng đường OSM
        {
          id: 'walk-casing', type: 'line', source: 'walkRoutes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            /* Viền dùng trắng/đen thuần, KHÔNG dùng c.routeCasing: trên nền
               vector tối, routeCasing là một xám lục nhạt gần như vô hình. */
            'line-color': sat ? '#0B1110' : '#FFFFFF',
            // Viền dày hơn thân tuyến khoảng 3,5px mỗi bên: đủ để tuyến tách
            // khỏi mọi thứ bên dưới — khối nhà, đường, ảnh vệ tinh — mà
            // không biến thành một dải trắng che mất nền.
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 13, 9],
            /* PHẢI theo cùng độ mờ với tuyến. Trước đây viền để cố định 0,95
               nên viền của TẤT CẢ tuyến luôn được vẽ, kể cả khi chế độ là
               'chỉ hiện khi trỏ vào' — bốn mươi tám dải xám chồng lên nhau.
               Đó chính là mớ rối người dùng nhìn thấy. */
            'line-opacity': this._routeOpacity(),
          },
        },
        {
          id: 'walk-route', type: 'line', source: 'walkRoutes',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            /* MỘT màu duy nhất, không phải màu nhóm. Mỗi lúc chỉ hiện đúng
               một tuyến nên màu không cần phân biệt nhóm nữa — nó chỉ cần
               NỔI. Màu nhóm khiến tuyến ngân hàng (#2C5C93) và bãi đỗ xe
               (#5A6B63) trông gần như đen trên nền 3D tối. */
            'line-color': '#F0682A',
            // Rê chuột lên marker → đường tương ứng dày lên. Đây là mẫu
            // liên kết danh sách ↔ bản đồ mà Zillow/Redfin/Rightmove đều có
            // và bản trước thiếu hẳn: mọi thứ trên bản đồ đều trơ.
            // Biểu thức `zoom` BẮT BUỘC nằm ngoài cùng — không được lồng nó
            // vào trong `case`. Lồng ngược lại thì MapLibre từ chối kiểu và
            // sự kiện `load` không bao giờ phát, nên bản đồ treo im lặng.
            'line-width': ['interpolate', ['linear'], ['zoom'],
              13, ['case', ['boolean', ['feature-state', 'hover'], false], 5.5, 3.6],
              16, ['case', ['boolean', ['feature-state', 'hover'], false], 8, 5.2]],
            // Độ mờ do _routeOpacity() dựng: nó phụ thuộc CHẾ ĐỘ TUYẾN
            // ('gần nhất mỗi nhóm' / 'tất cả' / 'tắt'), nên không viết cứng
            // ở đây mà đặt lại bằng setPaintProperty mỗi lần đổi chế độ.
            'line-opacity': this._routeOpacity(),
            'line-dasharray': [2, 1.1],
          },
        },
    ];
  }

  /** Đổi nền bản đồ. Dùng chung đường dựng lại lớp động với setTheme:
      setStyle() vứt sạch mọi nguồn dữ liệu, nên vòng bán kính, isochrone,
      đường đi bộ và marker tiện ích đều phải đắp lại sau 'styledata'. */
  async setBasemap(id) {
    if (!BASEMAPS[id] || id === this.basemapId) return this.basemapId;
    const base = BASEMAPS[id];
    /* Kiểu vector phải TẢI XONG rồi mới đổi. Đổi trước rồi tải sau sẽ dựng
       một kiểu rỗng trong lúc chờ, và người dùng thấy bản đồ trắng nháy. */
    if (base.kind === 'vector' && !this._vecStyle) {
      try {
        const r = await fetch(base.styleUrl);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this._vecStyle = await r.json();
      } catch (err) {
        this.onBasemapError?.(id, err);
        return this.basemapId;
      }
    }
    if (base.google && !base.tiles.length) {
      try { await ganPhienGoogle(base); } catch (err) { this.onBasemapError?.(id, err); return this.basemapId; }
    }
    this.basemapId = id;
    this._rebuildStyle();
    return id;
  }

  setTheme() { this._rebuildStyle(); }

  /** Dựng lại kiểu bản đồ rồi ĐẮP LẠI mọi lớp động.
      setStyle() vứt sạch nguồn dữ liệu, nên vòng bán kính, isochrone, đường
      đi bộ và marker tiện ích đều phải dựng lại sau sự kiện styledata — bản
      trước quên bước này nên đổi chế độ tối làm mất hết đường đi. */
  _rebuildStyle() {
    if (!this.map) return;
    // setStyle dựng lại toàn bộ nguồn dữ liệu, nên mọi lớp động (vòng bán
    // kính, đường đi bộ, marker tiện ích) phải được đắp lại sau khi kiểu mới
    // sẵn sàng. Bản trước quên bước này nên đổi chế độ tối làm mất đường đi.
    const cats = this.amenityCats ? [...this.amenityCats] : [];
    const sel = this.selectedId;
    const iso = this.isoOn, isoFor = this.isoFor;
    const tx = this.transitMode;
    this._stopDash();
    for (const m of this._txMarkers || []) m.remove();
    this._txMarkers = [];
    this.map.setStyle(this._style());
    this.map.once('styledata', () => {
      // setStyle() xoá sạch ảnh đã nạp — phải nạp lại trước khi bật lớp dùng nó.
      this._addBusIcon();
      this.map.getSource('rings')?.setData(sel ? this._ringsFor(sel) : empty());
      this.setRingsVisible(this.ringsOn !== false);
      if (iso) this.showIsochrones(isoFor, true);
      if (cats.length) this.showAmenities(sel, cats);
      // Lớp giao thông cũng là lớp động: nó có trạng thái bật/tắt riêng và
      // bốn marker DOM, cả hai đều bị setStyle() vứt đi.
      if (tx) this.setTransitMode(tx);
      if (this.areasOn != null) this.setAreasVisible(this.areasOn);
      this._apLopTrangRao();
    });
  }

  /* LỚP TOÀ TRANG RAO (QĐ 187, 189): 1.848 toà trên Saigon Office và Maison Office, NGOÀI 407 toà của thầy (trùng đã loại
     lúc sinh dữ liệu). Toạ độ đúng ghim lấy từ Google nên CHỈ vẽ khi nền là Google (điều khoản); đổi sang nền khác thì setStyle()
     tự bỏ lớp này. Giá là GIÁ CHÀO: chấm một màu, không tô theo thang giá niêm yết (gồm phí dịch vụ) của 407 toà; giá chỉ hiện khi bấm.
     Dữ liệu ở data/rieng/ (git bỏ qua; chế độ chia sẻ chặn), sinh bởi atlas/06_PHAN_TICH/kich_ban/n25_du_lieu_ban_do_pi.py. */
  async _apLopTrangRao() {
    if (DAY_DU) return;   // bản đầy đủ: tòa trang rao đã là tòa chính trên bản đồ, không vẽ lớp phụ nữa
    if (!BASEMAPS[this.basemapId]?.google || !this.map) return;
    if (!this._trangRao) {
      try {
        const r = await fetch('./data/rieng/toa_trang_rao.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        this._trangRao = await r.json();
      } catch (err) { this.onBasemapError?.('toa-trang-rao', err); return; }
    }
    if (!BASEMAPS[this.basemapId]?.google || this.map.getSource('trang-rao')) return;
    this.map.addSource('trang-rao', { type: 'geojson', data: { type: 'FeatureCollection', features: this._trangRao.toa.map((t, i) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: [t.lon, t.lat] }, properties: { i } })) } });
    this.map.addLayer({ id: 'trang-rao', type: 'circle', source: 'trang-rao', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 2.4, 14, 4, 17, 6.5],
      'circle-color': '#ffffff', 'circle-stroke-color': '#1a5fb4', 'circle-stroke-width': 1.6 } });
    if (this._trangRaoNghe) return;   // sự kiện gắn theo tên lớp nên sống qua setStyle(), chỉ gắn một lần
    this._trangRaoNghe = true;
    this.map.on('mouseenter', 'trang-rao', () => { this.map.getCanvas().style.cursor = 'pointer'; });
    this.map.on('mouseleave', 'trang-rao', () => { this.map.getCanvas().style.cursor = ''; });
    this.map.on('click', 'trang-rao', (e) => {
      const t = this._trangRao.toa[e.features[0].properties.i];
      const so = (x) => x.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      const tin = t.tin.map((x) => {
        let doi = '';
        if (x.gia != null && x.gia_ky1 != null && Math.abs(x.gia - x.gia_ky1) >= 0.005) {
          const p = (100 * (x.gia - x.gia_ky1)) / x.gia_ky1;
          doi = ` (${p > 0 ? '+' : ''}${so(p)}% so với tháng 7/2026)`;
        }
        return '<p class="ampop__note"><b>' + escapeHtml(x.trang) + ':</b> '
          + (x.gia != null ? so(x.gia) + ' USD/m²/tháng' : 'không công khai giá') + escapeHtml(doi)
          + ' · <a href="' + escapeHtml(x.url) + '" target="_blank" rel="noopener">xem tin</a></p>';
      }).join('');
      this.closePopup();
      this.popup = new this._ml.Popup({ closeOnClick: true, focusAfterOpen: false, offset: 10, maxWidth: '300px', className: 'mapop mapop--am' })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML('<div class="ampop"><h4 class="ampop__name">' + escapeHtml(t.ten) + '</h4>'
          + (t.dia_chi ? '<p class="ampop__note">' + escapeHtml(t.dia_chi) + '</p>' : '')
          + (t.hang ? '<p class="ampop__note">Hạng: ' + escapeHtml(t.hang) + '</p>' : '') + tin
          + '<p class="ampop__src">Giá chào cơ bản trên trang rao (chưa gồm phí dịch vụ), thu ngày 29/9/2026. Vị trí: '
          + (t.cach === 'ghim' ? 'đúng ghim trên trang rao' : t.cach === 'places' ? 'địa điểm Google Maps khớp tên và địa chỉ trên trang rao' : 'theo địa chỉ trên trang rao') + '.</p></div>')
        .addTo(this.map);
    });
  }

  /* =======================================================================
     THANG GIÁ CHO BẢN ĐỒ — năm bậc, tính trên TẬP ĐANG HIỆN.

     Vì sao màu phải mang nghĩa: bản trước vẽ 407 điểm bằng CÙNG một màu đen,
     cụm cũng đen, nên ở mức thành phố bản đồ chỉ nói được "có bao nhiêu",
     không nói được "ở đâu đắt". Toàn bộ tín hiệu giá bị dồn hết vào nhãn
     chữ — và 407 nhãn chữ thì không đọc nổi. Đó chính là chỗ rối.

     Tính trên tập ĐANG HIỆN chứ không phải toàn bộ 407: lọc còn 20 tòa
     trong một quận mà vẫn dùng thang của cả thành phố thì cả 20 rơi vào
     một bậc, và bản đồ lại trắng thông tin.

     ĐƠN VỊ: `baseRent` mang nhãn "đơn vị gốc chưa chuẩn hoá". Đo được rằng
     nó nhất quán MỘT đơn vị (hạng A trung vị 60,6 > B 33,7 > C 19,7; CBD
     28,9 > phân tán 15,9), nên XẾP HẠNG và SO SÁNH TƯƠNG ĐỐI là hợp lệ —
     đó đúng là thứ thang màu này thể hiện. Nhưng không được in
     "USD/m²/tháng" như thể đã kiểm chứng; chú giải phải nói rõ.
     ===================================================================== */
  _rentScale() {
    return rentScaleOf(this.buildings.filter((b) => this.visibleIds.has(b.id)));
  }

  /** Bậc giá của một tòa, hoặc -1 khi chưa có số. */
  _bucketOf(b, scale) {
    return isPresent(b.baseRent) ? scale?.bucket(b.baseRent.value) ?? -1 : -1;
  }

  /* Marker một tòa: chấm TÔ THEO BẬC GIÁ.

     Nhãn tên + giá chỉ mở khi rê chuột, lấy tiêu điểm, hoặc khi tòa đang
     được chọn. Hiện nhãn thường trực cho 407 điểm chính là lỗi cũ. */
  _markerEl(b, scale) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'mk';
    el.dataset.id = b.id;
    const k = this._bucketOf(b, scale);
    el.dataset.bucket = String(k);
    if (k >= 0) {
      el.style.setProperty('--mk-fill', `var(${RENT_RAMP[k]})`);
      el.style.setProperty('--mk-ink', `var(${RENT_ONRAMP[k]})`);
    }
    const price = isPresent(b.baseRent) ? money(b.baseRent.value) : null;
    el.innerHTML = `<span class="mk__dot${k < 0 ? ' mk__dot--na' : ''}" aria-hidden="true"></span>
      ${price ? `<span class="mk__price" aria-hidden="true">${price}</span>` : ''}
      <span class="mk__label" aria-hidden="true"><b>${escapeHtml(b.name)}</b><small>${
  price ? `${price} USD/m² · ${NHAN.giaNgan}` : 'chưa có giá'}</small></span>`;
    el.setAttribute('aria-label', markerLabel(b));
    el.addEventListener('click', (ev) => { ev.stopPropagation(); this.onSelect(b.id); });
    el.addEventListener('focus', () => this.onHover(b.id));
    el.addEventListener('blur', () => this.onHover(null));
    el.addEventListener('mouseenter', () => this.onHover(b.id));
    el.addEventListener('mouseleave', () => this.onHover(null));
    return el;
  }

  /* Cụm: MÀU = trung vị giá của cụm, KÍCH THƯỚC = số tòa.

     Hai kênh mã hoá hai đại lượng khác nhau, nên một cái nhìn đọc được cả
     "đông" lẫn "đắt". Bản trước dùng một màu cho mọi cụm nên chỉ đọc được
     "đông" — mà "đông" là thứ ít quan trọng nhất với người đi thuê. */
  _clusterEl(items, scale) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'mk mk--cluster';

    const vals = items.filter((b) => isPresent(b.baseRent)).map((b) => b.baseRent.value)
      .sort((a, b) => a - b);
    const med = vals.length ? vals[vals.length >> 1] : null;
    const k = med == null ? -1 : scale.bucket(med);
    if (k >= 0) {
      el.style.setProperty('--mk-fill', `var(${RENT_RAMP[k]})`);
      el.style.setProperty('--mk-ink', `var(${RENT_ONRAMP[k]})`);
    }
    el.dataset.bucket = String(k);
    // Bốn cỡ rời rạc, không tỉ lệ liên tục: mắt không đọc được chênh lệch
    // đường kính nhỏ, và cỡ liên tục làm cụm nhỏ tụt xuống dưới ngưỡng chạm.
    const n = items.length;
    el.dataset.size = n >= 25 ? 'xl' : n >= 10 ? 'lg' : n >= 5 ? 'md' : 'sm';
    el.innerHTML = `<span class="mk__cluster${k < 0 ? ' mk__cluster--na' : ''}" aria-hidden="true">${n}</span>`;

    const names = items.slice(0, 3).map((b) => b.name).join(', ');
    el.setAttribute('aria-label',
      `Cụm ${n} tòa nhà: ${names}${n > 3 ? ', và các tòa khác' : ''}. `
      + (med == null ? 'Chưa có số giá. ' : `Chỉ số giá trung vị của cụm ${money(med)}. `)
      + 'Bấm để phóng gần.');
    /* BẤM VÀO CỤM PHẢI CHO THÔNG TIN, KHÔNG CHỈ PHÓNG TO.

       Đo ở mức phóng mặc định: 36 cụm nhưng chỉ 27 chấm đơn. Nghĩa là phần
       lớn cú bấm rơi vào cụm — và bản trước chỉ phóng to, im lặng. Người
       dùng bấm mãi không thấy bảng nào hiện ra và kết luận là tính năng
       không có. Họ đúng: một cú bấm không trả lời gì là một cú bấm hỏng.

       Nay cụm MỞ DANH SÁCH những tòa bên trong, ngay trong bảng tiêu điểm,
       và vẫn đưa khung nhìn tới đó. Bấm tiếp một dòng là ra hồ sơ đầy đủ.
       Cụm chỉ có một tòa thật (nhiều hồ sơ cùng toạ độ) thì chọn thẳng —
       không bắt qua một bước chọn giữa một lựa chọn. */
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      const samePoint = items.every((b) => Math.abs(b.lat - items[0].lat) < 1e-7 && Math.abs(b.lng - items[0].lng) < 1e-7);
      if (items.length === 1 || samePoint) { this.onSelect(items[0].id); return; }
      this.onCluster(items.map((b) => b.id));
      if (this.map.getZoom() < 17) this.fitTo(items.map((b) => b.id));
    });
    return el;
  }

  /* =======================================================================
     BIỂU TƯỢNG XE BUÝT — chỉ xuất hiện khi đã phóng đủ gần

     2.156 điểm dừng. Ở mức nhìn toàn thành phố chúng chỉ có nghĩa là MẬT ĐỘ
     ("khu này mạng xe buýt dày hay thưa"), nên vẽ bằng chấm nhỏ là đúng —
     2.156 biểu tượng ở mức đó sẽ phủ kín bản đồ và xoá sạch mọi thứ khác.

     Từ z15,5 trở lên khung nhìn chỉ còn vài chục điểm, và lúc đó câu hỏi đổi
     thành "cái nào, ở đâu, tên gì" — đó là lúc biểu tượng có ích. Hai lớp
     giao nhau mềm ở dải 15,0–15,8 nên mắt không thấy một cú nhảy.

     Ảnh biểu tượng dựng bằng canvas rồi nạp qua addImage: không phụ thuộc
     tệp sprite ngoài, chạy được khi ngắt mạng. QUAN TRỌNG: setStyle() xoá
     sạch ảnh đã nạp, nên phải nạp lại sau mỗi lần dựng lại kiểu.
     ===================================================================== */
  _addBusIcon() {
    if (!this.map || this.map.hasImage?.('bus-pin')) return;
    const S = 56;                       // vẽ ở 2× rồi thu, cho nét trên màn Retina
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const x = cv.getContext('2d');
    // Bảng màu do _style() tính và lưu lại — dùng đúng tông của nền đang bật.
    const c = this._c || PALETTE.light;

    // Đĩa nền + viền: biểu tượng phải đọc được trên cả nền sáng, nền tối và
    // ảnh vệ tinh, nên nó tự mang nền chứ không dựa vào nền bản đồ.
    x.beginPath();
    x.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    /* Màu chọn bằng ĐO, không bằng mắt. Ba thứ dễ nhầm trên cùng bản đồ:
       tuyến metro #0079B8, thang giá xanh lá (đậm nhất #164A40), metro 2
       tím #8A5FC4. Xám lam #456175 có tương phản 4,36 với nền sáng nhạt
       nhất VÀ khoảng cách màu tệ nhất là 74 — cao nhất trong các ứng viên.
       Xanh lá bị loại (chỉ cách thang giá 44), xanh dương tươi bị loại
       (chỉ cách metro 63).

       TÔ ĐẶC màu tuyến, ký hiệu trắng — đảo lại so với bản trước. Đĩa trắng
       viền mảnh chìm hẳn vào nền bản đồ sáng: cả nền lẫn đĩa đều gần trắng
       nên chỉ còn cái viền để phân biệt, và ở 20px thì viền là thứ đầu tiên
       biến mất. Nền đặc thì hình dạng đọc được ở mọi cỡ. */
    x.fillStyle = c.busIcon || '#456175';
    x.fill();
    x.lineWidth = 3;
    x.strokeStyle = c.station || '#FFFFFF';
    x.stroke();

    // Thân xe buýt — hình khối đơn giản, đọc được ở 20px thật.
    x.fillStyle = c.station || '#FFFFFF';
    const w = 21, h = 23, ox = (S - w) / 2, oy = (S - h) / 2 - 1;
    x.beginPath();
    if (x.roundRect) x.roundRect(ox, oy, w, h - 4, 3);
    else x.rect(ox, oy, w, h - 4);
    x.fill();
    // Kính chắn gió: dải màu tuyến cắt ngang thân trắng
    x.fillStyle = c.busIcon || '#456175';
    x.fillRect(ox + 3, oy + 3.5, w - 6, 6);
    // Hai bánh
    x.fillStyle = c.station || '#FFFFFF';
    x.beginPath(); x.arc(ox + 5, oy + h - 4, 2.8, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(ox + w - 5, oy + h - 4, 2.8, 0, Math.PI * 2); x.fill();

    this.map.addImage('bus-pin', x.getImageData(0, 0, S, S), { pixelRatio: 2 });
  }

  _clearMarkers() {
    for (const entry of this.markers.values()) entry.marker.remove();
    this.markers.clear();
  }

  _rebuildMarkers() {
    if (!this.map || !this._ml) return;
    this._clearMarkers();
    const items = this.buildings.filter((b) => this.visibleIds.has(b.id));
    this.rentScale = this._rentScale();
    if (!items.length) { this.onScaleChange?.(null); return; }
    const scale = this.rentScale;
    const zoom = this.map.getZoom();
    /* Từ z15,5 trở lên các chấm đã tách hẳn nhau nên nhãn giá không còn
       chồng — đó chính là lúc con số có ích nhất và không gây rối. Dưới
       ngưỡng đó thì màu chấm đã mang thông tin giá rồi. */
    this.map.getContainer().dataset.zoomband = zoom >= 15.5 ? 'near' : 'far';
    const grid = zoom < 11.5 ? 76 : zoom < 13.5 ? 58 : 34;
    const groups = new Map();
    for (const building of items) {
      const point = this.map.project([building.lng, building.lat]);
      const key = building.id === this.selectedId
        ? `selected:${building.id}`
        : `${Math.floor(point.x / grid)}:${Math.floor(point.y / grid)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(building);
    }
    for (const [key, members] of groups) {
      const lat = members.reduce((sum, b) => sum + b.lat, 0) / members.length;
      const lng = members.reduce((sum, b) => sum + b.lng, 0) / members.length;
      const element = members.length > 1
        ? this._clusterEl(members, scale)
        : this._markerEl(members[0], scale);
      const marker = new this._ml.Marker({ element, anchor: 'center' }).setLngLat([lng, lat]).addTo(this.map);
      this.markers.set(key, { marker, ids: members.map((b) => b.id) });
    }
    // Chú giải phải đổi theo thang; thang đổi theo bộ lọc. Không đồng bộ thì
    // chú giải nói dối về ý nghĩa của màu đang hiện.
    this.onScaleChange?.(scale);
    this._paint();
  }

  setBuildings(ids) {
    const next = new Set(ids);
    this.visibleIds = next;
    if (this.selectedId && !next.has(this.selectedId)) this.closePopup();
    this._rebuildMarkers();
  }

  /* Chọn một tòa nhà.

     `popup` mặc định TẮT. Bản trước mở một thẻ nổi 300px ngay giữa bản đồ,
     trong khi bảng tiện ích 348px đã chiếm cạnh trái — hai tấm thẻ nói về
     CÙNG một tòa nhà, tranh nhau đúng khoảng pixel mà các tuyến đi bộ cần.
     Nay thông tin tòa nhà nằm trong bảng tiêu điểm cùng chỗ với tiện ích:
     một bề mặt trả lời một câu hỏi. Bản thân ghim đã mang trạng thái
     "đang chọn", nên vẫn biết thẻ đang nói về ghim nào. */
  /* Chọn ĐÚNG MỘT đa giác trong hình học truy vấn trả về.

     Bẫy đã đo được: OpenMapTiles GỘP nhiều khối nhà trong cùng một ô vector
     thành MỘT đặc trưng MultiPolygon — mẫu quan sát có 6 vòng, trải 536 ×
     888 m. Lấy nguyên đặc trưng đó mà tô là tô sáng cả dãy phố, đúng cảnh
     người dùng chụp lại: bấm một tòa, bốn tòa cách nhau cả cây số cùng sáng.

     Nên phải bóc lấy một vòng: vòng CHỨA toạ độ hồ sơ. Không vòng nào chứa
     thì lấy vòng gần nhất trong 40 m — toạ độ hồ sơ hay đặt ở lối vào chứ
     không phải giữa khối nhà. Xa hơn nữa thì không tô gì. */
  _pickPolygon(geom, lng, lat) {
    const polys = geom.type === 'MultiPolygon' ? geom.coordinates
      : geom.type === 'Polygon' ? [geom.coordinates] : [];
    if (!polys.length) return null;

    // Ray casting. Vòng đầu là biên ngoài, các vòng sau là lỗ.
    const inRing = (ring) => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat)
          && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi) inside = !inside;
      }
      return inside;
    };
    for (const p of polys) {
      if (!p.length || !inRing(p[0])) continue;
      if (p.slice(1).some((hole) => inRing(hole))) continue;   // rơi vào lỗ
      return { type: 'Polygon', coordinates: p };
    }

    const mPerLng = 111320 * Math.cos((lat * Math.PI) / 180);
    let best = null, bestD = Infinity;
    for (const p of polys) {
      for (const [x, y] of p[0] || []) {
        const d = Math.hypot((x - lng) * mPerLng, (y - lat) * 110574);
        if (d < bestD) { bestD = d; best = p; }
      }
    }
    return bestD <= 40 ? { type: 'Polygon', coordinates: best } : null;
  }

  /* Tìm mặt bằng nhà nằm dưới tọa độ hồ sơ và tô nó lên.

     Chạy lại sau mỗi lần khung nhìn đứng yên vì ô bản đồ vector nạp dần:
     ngay sau khi bay tới thì ô chứa tòa đó thường CHƯA về, truy vấn lúc ấy
     trả rỗng. Chạy một lần rồi thôi sẽ thành "lúc tô lúc không". */
  _paintSelectedFootprint() {
    const m = this.map;
    if (!m || !m.getLayer('b-sel-hit')) return;   // nền raster: không có mặt bằng
    const src = m.getSource('selFootprint');
    if (!src) return;
    const clear = () => src.setData(empty());

    const b = this.buildings.find((x) => x.id === this.selectedId);
    if (!b || !Number.isFinite(b.lat) || !Number.isFinite(b.lng) || m.getZoom() < 15) {
      clear(); return;
    }
    const pt = m.project([b.lng, b.lat]);
    const q = (box) => {
      try { return m.queryRenderedFeatures(box, { layers: ['b-sel-hit'] }) || []; }
      catch { return []; }         // ô bản đồ chưa nạp xong
    };
    /* KHÔNG lọc nguồn vector theo `id`. Id đặc trưng của ô vector chỉ duy
       nhất TRONG TỪNG Ô, không duy nhất toàn cầu — lọc theo id tô sáng một
       tòa ngẫu nhiên trong mỗi ô đang hiện. Đúng lỗi người dùng chụp lại:
       bấm một tòa, bốn tòa cách nhau cả cây số cùng sáng lên.

       Cách đúng: lấy THẲNG hình học đa giác mà truy vấn trả về và đặt vào
       nguồn GeoJSON riêng. Không có va chạm id, và tô đúng một hình.

       Trúng ngay tại điểm là chắc chắn nhất. Nới ±12 px chỉ là phương án
       hai: đo trên 30 tòa thì 20 trúng thẳng, thêm 7 trúng khi nới, 3 tòa
       OSM không có mặt bằng. Không nới thì mất 1/4 số tòa lẽ ra tô được;
       nới rộng hơn nữa thì bắt đầu tô trúng nhà bên cạnh. */
    const hit = q(pt)[0] || q([[pt.x - 12, pt.y - 12], [pt.x + 12, pt.y + 12]])[0];
    const poly = hit?.geometry ? this._pickPolygon(hit.geometry, b.lng, b.lat) : null;
    if (!poly) { this._lastFootprint = null; clear(); return; }
    // Ghi lại để kiểm thử đọc được: nguồn GeoJSON của MapLibre không cho
    // đọc lại dữ liệu đã đặt một cách đáng tin.
    this._lastFootprint = { type: 'Feature', properties: hit.properties, geometry: poly };
    src.setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {
          render_height: hit.properties?.render_height ?? 12,
          render_min_height: hit.properties?.render_min_height ?? 0,
        },
        geometry: poly,
      }],
    });
  }

  setSelected(id, { fly = true } = {}) {
    this.selectedId = id;
    this._paintSelectedFootprint();
    this._rebuildMarkers();
    this.map.getSource('rings')?.setData(id ? this._ringsFor(id) : empty());
    if (this.isoOn) this.showIsochrones(id, true);
    if (!id) { this.closePopup(); return; }
    const b = this.buildings.find((x) => x.id === id);
    if (!b) return;
    if (fly) {
      // flyTo tôn trọng padding khung nhìn, nên tòa nhà dừng ở giữa phần
      // CÒN THẤY ĐƯỢC chứ không phải giữa khung vẽ — tức không rơi xuống
      // dưới bảng tiêu điểm.
      const target = { center: [b.lng, b.lat], zoom: Math.max(this.map.getZoom(), 14.6) };
      // Giảm chuyển động: nhảy thẳng, không bay. Bất biến về tiếp cận.
      if (this.reducedMotion()) this.map.jumpTo(target);
      else this.map.flyTo({ ...target, duration: 480, essential: false });
    }
  }

  /** Đưa một địa điểm tiện ích vào tầm nhìn nếu nó đang nằm ngoài.
      Rê chuột lên một dòng danh sách mà bản đồ không nhúc nhích thì dòng đó
      không dẫn tới đâu cả. Chỉ dời khi THẬT SỰ ngoài khung — dời mỗi lần rê
      sẽ thành bản đồ nhảy liên tục dưới con trỏ. */
  revealAmenity(id) {
    const rec = this.routeIndex?.get(id);
    if (!rec || !this.map) return false;
    const p = [rec.place.lng, rec.place.lat];
    if (this._allInView([p], 16)) return false;
    const b = this.buildings.find((x) => x.id === this.selectedId);
    const pts = b ? [p, [b.lng, b.lat]] : [p];
    return this._fitPoints(pts, { force: true, margin: 60 });
  }

  closePopup() { this.popup?.remove(); this.popup = null; }

  setCompare(ids) { this.compareIds = new Set(ids); this._paint(); }

  /* =======================================================================
     Tiện ích mở từ OpenStreetMap + đường đi bộ thật

     ĐÂY LÀ TẬP DỮ LIỆU KHÁC với tiện ích Google Places trong payload.
     Nguồn: OpenStreetMap (ODbL) — nên ĐƯỢC PHÉP vẽ lên bản đồ OSM
     (Pattern A của GOOGLE_OPEN_MAP_ARCHITECTURE_R1). Dữ liệu Google vẫn
     chỉ nằm ở dạng danh sách trong hồ sơ và không bao giờ lên bản đồ.
     ===================================================================== */
  /* =======================================================================
     LỚP GIAO THÔNG — xe buýt, đường sắt quốc gia, metro đang xây, sân bay

     Nguồn: OpenStreetMap, đóng băng bởi build/build_transit.mjs. KHÔNG có
     một toạ độ nào được nội suy: chỗ nào OSM không có thì ứng dụng nói ra
     là chưa có, chứ không vẽ áng chừng theo bản đồ quy hoạch.

     Ba khoảng trống đã biết, in nguyên văn từ `_gaps` của tệp dữ liệu ra
     chú giải: metro 3/4/5 không có trong OSM; metro 2 có tuyến nhưng không
     có ga; và `amenity=bus_station` ở TP.HCM phần lớn là nhà xe khách tư
     nhân nên không dùng.
     ===================================================================== */
  /* ---- Khu vực (phường) + mốc CBD -------------------------------------
     Mốc CBD KHÔNG có trong payload; nó được giải ngược từ 12 giá trị
     distanceCbdM với sai số lớn nhất 0,01 m, rồi đối chiếu OSM để đặt tên
     (trụ sở UBND TP, góc Nguyễn Huệ × Lê Thánh Tôn). Nhờ vậy ghim trên bản
     đồ và con số trong bảng nói về CÙNG một điểm — nếu đặt toạ độ tay thì
     hai thứ đó sẽ lệch nhau mà không ai biết.                            */
  _cbdGeo() {
    const c = this.areaData?.cbd;
    if (!c) return empty();
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: c.name, where: c.where },
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      }],
    };
  }

  setAreaData(data) {
    this.areaData = data;
    this.map?.getSource('wards')?.setData(data?.layers?.wards || empty());
    this.map?.getSource('cbd')?.setData(this._cbdGeo());
    if (this.areasOn != null) this.setAreasVisible(this.areasOn);
    this._paintTransitMarkers();
  }

  /** Bật/tắt lớp ranh giới phường. */
  setAreasVisible(on) {
    this.areasOn = !!on;
    for (const id of ['ward-fill', 'ward-line']) {
      if (this.map?.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    return this.areasOn;
  }

  setTransitData(data) {
    this.transitData = data;
    const set = (src, key) => this.map?.getSource(src)?.setData(data?.layers?.[key] || empty());
    set('metroFuture', 'metro_future');
    set('railLine', 'rail_national');
    set('busStops', 'bus_stops');
    if (this.transitMode) this.setTransitMode(this.transitMode);
  }

  /** 'full' (mọi phương tiện) | 'metro' (chỉ đường ray) | 'off'. */
  setTransitMode(mode) {
    this.transitMode = ['full', 'metro', 'off'].includes(mode) ? mode : 'full';
    const on = this.transitMode !== 'off';
    const bus = this.transitMode === 'full';
    const vis = (id, show) => {
      if (this.map?.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    };
    vis('bus-stops', bus);
    vis('bus-icons', bus);
    for (const id of ['rail-base', 'rail-hatch', 'metro2-halo', 'metro2-line']) vis(id, on);
    this._paintTransitMarkers();
    return this.transitMode;
  }

  /* Ga đường sắt và sân bay là điểm CÓ TÊN, và tên là nửa thông tin: "một
     chấm ở đây" không nói được đó là Ga Sài Gòn hay một cái kho.

     Chúng phải là marker DOM chứ không phải lớp symbol của MapLibre, vì kiểu
     bản đồ này KHÔNG khai báo `glyphs` — nền chạy hoàn toàn ngoại tuyến nên
     không có kho chữ để MapLibre vẽ text-field. Bù lại chỉ có bốn điểm, nên
     bốn phần tử DOM không phải là cái giá gì. */
  _paintTransitMarkers() {
    for (const m of this._txMarkers || []) m.remove();
    this._txMarkers = [];
    if (this.transitMode === 'off' || !this.transitData) return;

    /* GA METRO CÓ KÝ HIỆU RIÊNG, không còn là chấm tròn trơn.

       Trước đây mười bốn ga của tuyến số 1 chỉ là lớp `circle` bán kính 4,5px:
       cùng hình với mọi chấm khác trên bản đồ, không tên, không nói được nó là
       một cái ga. Mà ga metro là thứ quyết định — cả cột "cách ga bao xa" trong
       danh sách đều quy về mấy điểm này.

       Nay chúng dùng chung họ ghim với ga đường sắt và sân bay, chỉ khác màu:
       vòng màu tuyến (xanh metro chính thức theo thẻ OSM) thay vì mực xám. */
    const items = [
      ...(this.stations || []).map((st) => ({
        f: {
          properties: { name: st.name, osmId: st.id || null },
          geometry: { type: 'Point', coordinates: [st.longitude, st.latitude] },
        },
        kind: 'metro', icon: 'metro', note: 'Ga Metro số 1 · đang khai thác',
      })),
      ...(this.transitData.layers?.rail_stations?.features || [])
        .map((f) => ({ f, kind: 'rail', icon: 'rail', note: 'Ga đường sắt Bắc – Nam' })),
      /* Chỉ hai sân bay có liên quan tới thị trường văn phòng TP.HCM. Hộp
         bao rộng còn kéo về Vũng Tàu và hai sân bay quân sự — vẽ chúng lên
         là thêm nhiễu chứ không thêm thông tin.

         Trạng thái đọc TỪ DỮ LIỆU (tag `construction:` của OSM), không đoán:
         Long Thành đang xây dựng, và một sân bay chưa khai thác không được
         vẽ như một sân bay đang khai thác. */
      ...(this.transitData.layers?.airport?.features || [])
        .filter((f) => ['SGN', 'LTH'].includes(f.properties.iata))
        .map((f) => ({ f, kind: 'air', icon: 'plane',
          building: f.properties.status === 'construction',
          note: f.properties.status === 'construction'
            ? 'Sân bay quốc tế · đang xây dựng' : 'Sân bay quốc tế · đang khai thác' })),
      ...(this.areaData?.cbd ? [{
        f: {
          properties: { name: 'Trung tâm', osmId: null },
          geometry: { type: 'Point', coordinates: [this.areaData.cbd.lng, this.areaData.cbd.lat] },
        },
        kind: 'cbd', icon: 'cbd',
        note: 'Mốc đo khoảng cách tới trung tâm · ' + this.areaData.cbd.where,
      }] : []),
    ];

    for (const it of items) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'txk txk--' + it.kind + (it.building ? ' is-building' : '');
      el.innerHTML = '<span class="txk__pin" aria-hidden="true">' + (TRANSIT_ICONS[it.icon] || '') + '</span>'
        + '<span class="txk__lab" aria-hidden="true">' + escapeHtml(it.f.properties.name) + '</span>';
      el.setAttribute('aria-label', it.note + ': ' + it.f.properties.name
        + '. Nguồn OpenStreetMap. Bấm để xem chi tiết.');
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.closePopup();
        this.popup = new this._ml.Popup({
          closeOnClick: false, focusAfterOpen: false, offset: 14, maxWidth: '260px',
          className: 'mapop mapop--am',
        }).setLngLat(it.f.geometry.coordinates).setHTML(
          '<div class="ampop"><h4 class="ampop__name">' + escapeHtml(it.f.properties.name) + '</h4>'
          + '<p class="ampop__note">' + escapeHtml(it.note)
          + (it.f.properties.iata ? ' · mã IATA ' + escapeHtml(it.f.properties.iata) : '') + '.</p>'
          + '<p class="ampop__src">Nguồn: OpenStreetMap (ODbL) · <code>'
          + escapeHtml(it.f.properties.osmId || '—') + '</code></p></div>').addTo(this.map);
      });
      this._txMarkers.push(new this._ml.Marker({ element: el, anchor: 'center' })
        .setLngLat(it.f.geometry.coordinates).addTo(this.map));
    }
    this._zoomTransit();
  }

  setAmenityData(data) { this.amenityData = data; }

  /** Cách vẽ đường đi bộ: 'lead' (chỉ gần nhất mỗi nhóm) | 'all' | 'off'. */
  setRouteMode(mode) {
    this.routeMode = ['lead', 'all', 'off'].includes(mode) ? mode : 'lead';
    if (this.map?.getLayer('walk-route')) {
      this.map.setPaintProperty('walk-route', 'line-opacity', this._routeOpacity());
      if (this.map.getLayer('walk-casing')) {
        this.map.setPaintProperty('walk-casing', 'line-opacity', this._routeOpacity());
      }
    }
    return this.routeMode;
  }

  /* -----------------------------------------------------------------------
     BA BẬC HIỂN THỊ, thay cho "hiện hết cùng một lúc".

       chấm   mọi địa điểm — thấy CÓ GÌ, Ở PHÍA NÀO, không phải đọc chữ
       nhãn   chỉ địa điểm GẦN NHẤT của mỗi nhóm — tối đa tám chữ, không 48
       thẻ    đúng MỘT cái đang trỏ tới — tên, phút, mét, hệ số vòng

     Vì sao phải đổi: bản trước gắn nhãn cho cả 48 địa điểm. Nhãn chồng nhau
     nên tên bị cắt cụt ("Mì Quảng Rau …"), và ở mức thu nhỏ cả cụm dồn
     thành một vệt màu không mang thông tin gì. Đó là một DANH SÁCH bị vẽ
     lên bản đồ ở bố cục tệ nhất có thể: vị trí ngẫu nhiên, chữ cắt cụt,
     không xếp được theo thứ tự nào.

     Câu người thuê thật sự hỏi là "GẦN NHẤT CÓ GÌ". Tám nhãn trả lời được
     câu đó; bốn mươi tám nhãn thì không. Phần còn lại chuyển sang danh
     sách xếp hạng bên cạnh bản đồ — nơi một danh sách vốn thuộc về.
     -------------------------------------------------------------------- */
  showAmenities(buildingId, cats) {
    this.amenityCats = new Set(cats || []);
    for (const m of this.amenityMarkers || []) m.remove();
    this.amenityMarkers = [];
    this.routeIndex = new Map();      // rid → { place, style, cat, lead }

    const entry = buildingId && this.amenityData?.buildings?.[buildingId];
    if (!entry || !this.amenityCats.size) {
      this.map.getSource('walkRoutes')?.setData(empty());
      this.routeCount = 0;
      this.amenityList = [];
      this._stopDash();
      return { count: 0, routes: 0, list: [], leads: 0 };
    }

    const routes = [];
    const list = [];
    let count = 0, rid = 0;

    for (const cat of entry.categories) {
      if (!this.amenityCats.has(cat.key)) continue;
      const style = AMENITY_STYLE[cat.key];
      const usable = amenityPlaces(cat.key, cat.places);
      if (!style || !usable?.length) continue;

      // Gần nhất đứng đầu. "Gần nhất của nhóm" là địa điểm DUY NHẤT được
      // gắn nhãn thường trực, nên thứ tự phải xác định — không được phụ
      // thuộc thứ tự tình cờ trong tệp dữ liệu.
      const places = [...usable].sort((a, b) => a.walkMin - b.walkMin || a.walkM - b.walkM);

      places.forEach((p, i) => {
        count++;
        const id = ++rid;
        const lead = i === 0;

        // MỌI tuyến đều nằm trong nguồn, kể cả tuyến đang ẩn: rê chuột vào
        // một địa điểm bất kỳ phải bật được tuyến của nó ngay, không đợi
        // dựng lại nguồn. Việc ẩn/hiện do biểu thức độ mờ lo.
        if (p.route?.length > 1) {
          routes.push({
            type: 'Feature',
            id,
            properties: {
              rid: id, color: style.color, cat: cat.key,
              name: p.name, min: p.walkMin, lead,
            },
            geometry: { type: 'LineString', coordinates: p.route },
          });
        }
        this.routeIndex.set(id, { place: p, style, cat: cat.key, lead });
        list.push({
          rid: id, cat: cat.key, catLabel: style.label, color: style.color, icon: style.icon,
          lead, name: p.name, kind: p.kind, walkMin: p.walkMin, walkM: p.walkM,
          straightM: p.straightM, detourRatio: p.detourRatio,
        });
        this.amenityMarkers.push(
          new this._ml.Marker({ element: this._amenityEl(id, p, style, cat.key, lead), anchor: 'center' })
            .setLngLat([p.lng, p.lat]).addTo(this.map));
      });
    }

    // Danh sách trả về đã xếp theo phút đi bộ — panel bên cạnh dùng thẳng.
    list.sort((a, b) => a.walkMin - b.walkMin || a.walkM - b.walkM);
    this.amenityList = list;

    this.map.getSource('walkRoutes')?.setData({ type: 'FeatureCollection', features: routes });
    this.routeCount = routes.length;
    if (this.map.getLayer('walk-route')) {
      this.map.setPaintProperty('walk-route', 'line-opacity', this._routeOpacity());
    }
    this._placeLabels();
    this._startDash();
    return {
      count, routes: routes.length, list,
      leads: list.filter((x) => x.lead).length,
    };
  }

  /** Phần tử marker tiện ích. Neo 0×0 — xem chú thích ở .amk trong CSS. */
  _amenityEl(id, p, style, catKey, lead) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'amk' + (lead ? ' is-lead' : '');
    el.dataset.rid = String(id);
    el.dataset.cat = catKey;
    el.dataset.min = String(p.walkMin);
    if (lead) el.dataset.lead = '1';
    el.style.setProperty('--amk-color', style.color);

    const detour = String(p.detourRatio ?? '—').replace('.', ',');
    /* SỐ PHÚT NẰM NGAY TRÊN CHẤM, cho MỌI địa điểm — không chỉ cái gần nhất.

       Bản trước: chấm trơn 11px, không mang thông tin gì ngoài "có một cái
       gì đó ở đây". Muốn biết xa gần phải rê từng cái một. Đó chính là
       "khoảng cách gần như không thấy được": bản đồ hiện VỊ TRÍ nhưng giấu
       KHOẢNG CÁCH, mà khoảng cách mới là thứ người thuê đi tìm.

       Cách đọc: chấm gần nhất mỗi nhóm = đĩa đặc màu nhóm, số trắng. Các
       chấm còn lại = đĩa trắng, viền và số màu nhóm — nhẹ hơn hẳn nên
       hàng chục cái cùng lúc vẫn đọc được, mà vẫn nói ngay mấy phút.
       Mọi cặp màu-nhóm trên nền trắng đều ≥ 4,5:1, đủ ngưỡng chữ AA. */
    /* GHIM = KÝ HIỆU NHÓM + SỐ PHÚT.

       Bản trước chỉ có con số. Con số trả lời "bao xa" nhưng không trả lời
       "cái gì" — nên vẫn phải đối chiếu màu với dãy nút nhóm mới biết chấm
       màu tím là hàng tiện lợi hay khách sạn. Màu là kênh yếu: tám màu cạnh
       nhau ở cỡ 12px thì tím với tím-xanh gần như một, và người mù màu thì
       mất hẳn kênh đó.

       Ký hiệu đặc + con số = hai kênh độc lập, đọc được ngay trên bản đồ,
       không cần tra chú giải và không phụ thuộc vào việc phân biệt màu. */
    const g = AMENITY_ICONS[style.icon] || '';
    const dot = '<span class="amk__ic">' + g + '</span><b>' + p.walkMin + '</b>';
    const labl = lead ? '<span class="amk__lab" aria-hidden="true">' + escapeHtml(p.name) + '</span>' : '';
    el.innerHTML = '<span class="amk__dot" aria-hidden="true">' + dot + '</span>'
      + labl
      + '<span class="amk__card" aria-hidden="true">'
      +   '<span class="amk__ctop">'
      +     '<span class="amk__min"><b>' + p.walkMin + '</b><i>phút</i></span>'
      +     '<span class="amk__who"><b>' + escapeHtml(p.name) + '</b>'
      +       '<i>' + escapeHtml(style.label) + '</i></span>'
      +   '</span>'
      +   '<span class="amk__cbot">'
      +     '<span><b>' + p.walkM + '</b> m đi bộ</span>'
      +     '<span><b>' + p.straightM + '</b> m đường thẳng</span>'
      +     '<span>vòng <b>' + detour + '</b>×</span>'
      +   '</span>'
      +   '<span class="amk__tail"></span>'
      + '</span>';
    el.setAttribute('aria-label',
      escapeHtml(p.name) + ', ' + style.label + '. Đi bộ ' + p.walkM + ' mét, khoảng '
      + p.walkMin + ' phút. Đường chim bay ' + p.straightM + ' mét, hệ số vòng '
      + detour + ' lần. Nguồn OpenStreetMap. Bấm để xem chi tiết.');

    el.addEventListener('mouseenter', () => this.highlightRoute(id));
    el.addEventListener('focus', () => this.highlightRoute(id));
    el.addEventListener('mouseleave', () => this.highlightRoute(null));
    el.addEventListener('blur', () => this.highlightRoute(null));
    el.addEventListener('click', (ev) => { ev.stopPropagation(); this.openAmenityPopup(id); });
    return el;
  }

  /** Độ mờ tuyến đi bộ. KHÔNG có biểu thức `zoom` ở đây — chỉ ở line-width. */
  _routeOpacity() {
    const mode = this.routeMode || 'lead';
    if (mode === 'off') {
      return ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0];
    }
    // Sàn 0,74 chứ không phải 0,5: tuyến mười lăm phút vẫn phải ĐỌC ĐƯỢC.
    // Nhạt dần theo thời gian là để xếp hạng thị giác, không phải để làm
    // biến mất thứ người dùng vừa bật lên.
    const shown = ['interpolate', ['linear'], ['get', 'min'], 1, 0.95, 15, 0.74];
    const base = mode === 'all'
      ? shown
      : ['case', ['boolean', ['get', 'lead'], false], shown, 0];
    // Khi đang trỏ vào một tuyến: tuyến đó rõ hẳn, phần còn lại lùi xuống
    // gần như mất — mắt chỉ đọc nổi MỘT tuyến tại một thời điểm.
    const dimmed = mode === 'all'
      ? 0.1
      : ['case', ['boolean', ['get', 'lead'], false], 0.16, 0];
    return ['case',
      ['boolean', ['feature-state', 'hover'], false], 1,
      ['boolean', ['feature-state', 'dim'], false], dimmed,
      base];
  }

  /* -----------------------------------------------------------------------
     Cổng mức phóng + tránh va chạm nhãn, trong không gian MÀN HÌNH.

     CỔNG MỨC PHÓNG: dưới z13,4 cả cụm tiện ích dồn vào vài chục pixel —
     chấm chồng chấm thành một vệt màu không mang thông tin. Ẩn hẳn trung
     thực hơn là vẽ một vệt. Nhãn tên cần thêm chỗ nên bật muộn hơn, z14,6.

     TRÁNH VA CHẠM: chỉ còn tối đa tám nhãn (gần nhất mỗi nhóm) phải xếp,
     thay vì bốn mươi tám. Ưu tiên GẦN HƠN THÌ THẮNG. Hai bậc là đủ: còn
     chỗ thì hiện tên, hết chỗ thì rút về chấm mang số phút — chấm KHÔNG
     bao giờ bị giấu, vì vị trí là thứ bản đồ phải nói cho bằng được.

     Chạy khi khung nhìn đứng yên, không chạy trong lúc kéo: đo hình hộp
     hàng chục lần mỗi khung hình sẽ giật.
     -------------------------------------------------------------------- */
  _placeLabels() {
    const list = this.amenityMarkers || [];
    if (!list.length) {
      this.pillsShown = 0; this.pillsCompact = 0; this.pillsHidden = 0;
      this.zoomGated = false; this.dotsCompact = 0;
      return { shown: 0, compact: 0, hidden: 0, zoomGated: false, dotsCompact: 0 };
    }
    const z = this.map?.getZoom() ?? 15;
    const showDots = z >= 13.4;
    // Số phút trên chấm cần chỗ hơn chính cái chấm. Giữa z13,4 và z14,5 cả
    // cụm còn dồn sát nhau, nên các chấm phụ rút về đĩa trơn — vị trí vẫn
    // đúng, chỉ tạm bỏ con số. Chấm gần nhất mỗi nhóm luôn giữ số: nhiều
    // nhất tám cái, không bao giờ dồn thành vệt.
    const showNums = z >= 14.5;
    const showLabels = z >= 14.6;

    for (const m of list) {
      const el = m.getElement();
      el.classList.toggle('is-faded', !showDots);
      el.classList.toggle('is-plain', !showNums);
      el.classList.remove('is-bare');
      el.classList.remove('is-nolabel');
    }
    this.zoomGated = !showDots;
    if (!showDots) {
      this.pillsShown = 0; this.pillsCompact = 0; this.pillsHidden = list.length;
      this.dotsCompact = list.length;
      return { shown: 0, compact: 0, hidden: list.length, zoomGated: true, dotsCompact: list.length };
    }

    /* TRÁNH VA CHẠM CHO CẢ CON SỐ TRÊN CHẤM, không chỉ cho nhãn tên.

       Bật cả tám nhóm quanh một tòa ở trung tâm cho ra bốn mươi lăm địa
       điểm, và chỗ sát tòa nhà thì mười cái dồn vào vài chục pixel. Mười
       đĩa mang số chồng lên nhau không đọc được cái nào — tệ hơn hẳn một
       cụm chấm trơn, vì chấm trơn ít ra còn nói đúng "ở đây có nhiều chỗ".

       Cùng luật với nhãn tên: GẦN HƠN THÌ THẮNG. Cái nào bị chèn thì rút về
       đĩa trơn 13px. Không cái nào bị giấu và không cái nào bị xê dịch —
       vị trí là thứ bản đồ phải nói cho bằng được, và kiểm thử G-7 canh
       đúng điểm này với ngưỡng 2px.

       Đo bằng project() chứ không phải getBoundingClientRect(): bốn mươi
       lăm lần đọc hình hộp là bốn mươi lăm lần buộc trình duyệt tính lại
       bố cục, ngay trong lúc bản đồ vừa dừng. Kích thước đĩa là hằng số đã
       biết nên không cần hỏi DOM. */
    if (showNums) {
      /* BA BẬC RÚT GỌN, và bậc cuối vẫn KHÔNG giấu gì.

           đầy đủ    ký hiệu + số phút   — đọc được cả "cái gì" lẫn "bao xa"
           gọn       chỉ ký hiệu         — mất số, giữ loại
           trần      chấm 12px           — mất cả hai, giữ VỊ TRÍ

         Vị trí là thứ bản đồ phải nói cho bằng được, nên không có bậc thứ
         tư. Ưu tiên: gần nhất mỗi nhóm trước, rồi tới thời gian đi bộ.

         ĐỌC HÌNH HỘP THEO LÔ. Bề rộng viên thuốc phụ thuộc số chữ số và
         phụ thuộc bộ chữ của từng giao diện, nên phải ĐO chứ không đoán —
         nhưng đọc-ghi xen kẽ bốn mươi lăm lần sẽ ép trình duyệt tính lại bố
         cục bốn mươi lăm lần, ngay lúc bản đồ vừa dừng. Nên: xoá sạch lớp
         trạng thái (ghi) → đọc hết bề rộng (đọc) → gán lớp (ghi). Hai lần
         tính bố cục, không phải bốn mươi lăm. */
      const ICON = 22, BARE = 12;   // khớp CSS .amk.is-plain / .amk.is-bare
      const entries = list
        .map((m) => ({ el: m.getElement(), ll: m.getLngLat() }))
        .map((it) => ({ ...it, lead: !!it.el.dataset.lead, min: Number(it.el.dataset.min) || 99 }))
        .sort((a, b) => (b.lead - a.lead) || (a.min - b.min));

      for (const it of entries) {
        const d = it.el.querySelector('.amk__dot');
        it.w = d ? d.offsetWidth : ICON;
        it.h = d ? d.offsetHeight : ICON;
        it.p = this.map.project(it.ll);
      }

      const PAD = 2;
      const boxes = [];
      const at = (it, w, h) => ({
        l: it.p.x - w / 2 - PAD, t: it.p.y - h / 2 - PAD,
        r: it.p.x + w / 2 + PAD, b: it.p.y + h / 2 + PAD,
      });
      const hit = (b) => boxes.some((p) => !(b.r < p.l || b.l > p.r || b.b < p.t || b.t > p.b));

      let dotsCompact = 0, bare = 0;
      for (const it of entries) {
        const full = at(it, it.w, it.h);
        if (!hit(full)) { boxes.push(full); continue; }
        const icon = at(it, ICON, ICON);
        if (!hit(icon)) { it.el.classList.add('is-plain'); dotsCompact++; boxes.push(icon); continue; }
        // Chấm trần KHÔNG chiếm chỗ của ai: nó đã nhường hết những gì có thể
        // nhường, và ghi nó vào danh sách chắn chỗ sẽ đẩy cả cụm thành trần.
        it.el.classList.add('is-plain', 'is-bare');
        dotsCompact++; bare++;
      }
      this.dotsCompact = dotsCompact;
      this.dotsBare = bare;
    } else {
      this.dotsCompact = list.length - list.filter((m) => m.getElement().dataset.lead).length;
      this.dotsBare = 0;
    }

    const leads = list
      .map((m) => m.getElement())
      .filter((el) => el.dataset.lead)
      .map((el) => ({ el, min: Number(el.dataset.min) || 99 }))
      .sort((a, b) => a.min - b.min);

    if (!showLabels) {
      for (const it of leads) it.el.classList.add('is-nolabel');
      this.pillsShown = leads.length; this.pillsCompact = leads.length; this.pillsHidden = 0;
      return { shown: leads.length, compact: leads.length, hidden: 0, zoomGated: false, dotsCompact: this.dotsCompact };
    }

    const PAD = 5;
    const placed = [];
    const boxOf = (el) => {
      const lab = el.querySelector('.amk__lab');
      if (!lab) return null;
      const r = lab.getBoundingClientRect();
      return r.width ? { l: r.left - PAD, t: r.top - PAD, r: r.right + PAD, b: r.bottom + PAD } : null;
    };
    const clashes = (b) => placed.some((p) => !(b.r < p.l || b.l > p.r || b.b < p.t || b.t > p.b));

    let compact = 0;
    for (const it of leads) {
      const box = boxOf(it.el);
      if (!box) continue;
      if (clashes(box)) { it.el.classList.add('is-nolabel'); compact++; }
      else placed.push(box);
    }
    this.pillsShown = leads.length;
    this.pillsCompact = compact;
    this.pillsHidden = 0;
    return { shown: leads.length, compact, hidden: 0, zoomGated: false, dotsCompact: this.dotsCompact };
  }

  /* Nhãn ga chỉ bật khi đã đủ chỗ. Ga metro đông nhất (mười bốn cái dọc một
     tuyến) nên bật muộn nhất; ga đường sắt và sân bay chỉ có bốn nên bật sớm. */
  _zoomTransit() {
    const z = this.map?.getZoom() ?? 12;
    for (const m of this._txMarkers || []) {
      const el = m.getElement();
      const metro = el.classList.contains('txk--metro');
      el.classList.toggle('is-nolabel', z < (metro ? 12.8 : 10.5));
      el.classList.toggle('is-small', metro && z < 11.6);
    }
  }

  /* Bảng tiêu điểm biết `osmId` của địa điểm, còn lớp tuyến đánh số theo
     `rid` sinh lúc dựng. Hàm này bắc cầu giữa hai cách định danh đó, nên
     bảng không phải biết gì về cách đánh số bên trong bản đồ. */
  highlightByOsmId(osmId) {
    if (!osmId || !this.routeIndex) { this.highlightRoute(null); return null; }
    for (const [rid, rec] of this.routeIndex) {
      if (rec.place?.osmId === osmId) { this.highlightRoute(rid); return rid; }
    }
    this.highlightRoute(null);
    return null;
  }

  /** Đưa khung nhìn ôm trọn tòa nhà và một địa điểm tiện ích. */
  fitToPair(lat1, lng1, lat2, lng2) {
    if (!this.map || !this._ml) return;
    const b = new this._ml.LngLatBounds([lng1, lat1], [lng1, lat1]);
    b.extend([lng2, lat2]);
    this.map.fitBounds(b, { padding: { top: 70, bottom: 70, left: 70, right: 70 },
      maxZoom: 17, duration: this.reducedMotion() ? 0 : 620 });
  }

  /** Làm nổi một đường đi và mờ các đường còn lại. `null` để bỏ nổi. */
  highlightRoute(id) {
    if (!this.map?.getSource('walkRoutes')) return;
    const set = (rid, key, val) => {
      try { this.map.setFeatureState({ source: 'walkRoutes', id: rid }, { [key]: val }); } catch { /* nguồn chưa sẵn */ }
    };
    for (const rid of this.routeIndex?.keys() || []) {
      set(rid, 'hover', id != null && rid === id);
      set(rid, 'dim', id != null && rid !== id);
    }
    for (const m of this.amenityMarkers || []) {
      const el = m.getElement();
      const mine = id != null && el.dataset.rid === String(id);
      el.classList.toggle('is-hot', mine);
      el.classList.toggle('is-dim', id != null && !mine);
    }
    this.hotRoute = id;
    this.onAmenityHover(id);
  }

  /** Popup chi tiết cho một tiện ích mở. */
  openAmenityPopup(id) {
    const rec = this.routeIndex?.get(id);
    if (!rec) return;
    const { place: p, style } = rec;
    this.closePopup();
    const detour = p.detourRatio != null ? String(p.detourRatio).replace('.', ',') : '—';
    const html = `<div class="ampop">
      <div class="ampop__head" style="--amk-color:${style.color}">
        <span class="ampop__ic">${AMENITY_ICONS[style.icon] || ''}</span>
        <span class="ampop__cat">${escapeHtml(style.label)}</span>
      </div>
      <h4 class="ampop__name">${escapeHtml(p.name)}</h4>
      <dl class="ampop__grid">
        <div><dt>Đi bộ</dt><dd><b>${p.walkM}</b> m · ${p.walkMin} phút</dd></div>
        <div><dt>Đường thẳng</dt><dd>${p.straightM} m</dd></div>
        <div><dt>Hệ số vòng</dt><dd>${detour}×</dd></div>
      </dl>
      <p class="ampop__note">Đường đi tính trên hình học mạng đường OpenStreetMap.
        Ước lượng — không xét đèn tín hiệu, cầu vượt bộ hành hay giờ cấm.</p>
      <p class="ampop__src">Nguồn: OpenStreetMap (ODbL) · <code>${escapeHtml(p.osmId || '—')}</code></p>
    </div>`;
    this.popup = new this._ml.Popup({
      closeOnClick: false, focusAfterOpen: false, offset: 16, maxWidth: '290px', className: 'mapop mapop--am',
    }).setLngLat([p.lng, p.lat]).setHTML(html).addTo(this.map);
    this.highlightRoute(id);
  }

  clearAmenities() { this.showAmenities(null, []); }

  /** Bật/tắt vòng tròn bán kính đường thẳng (500 m / 1 km). */
  setRingsVisible(on) {
    this.ringsOn = !!on;
    for (const id of ['rings-fill', 'rings-line']) {
      if (this.map?.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
  }

  /* --- Isochrone đi bộ -------------------------------------------------- */
  setIsochroneData(data) { this.isoData = data; }

  /** Bật/tắt vùng đi bộ 5/10/15 phút cho một tòa. */
  showIsochrones(buildingId, on) {
    this.isoOn = !!on;
    this.isoFor = buildingId || null;
    const src = this.map?.getSource('isochrones');
    if (!src) { this.isoBands = 0; this.isoFeatures = null; return { bands: 0 }; }
    const fc = on && buildingId && this.isoData?.buildings?.[buildingId];
    src.setData(fc || empty());
    // Phơi ra công khai. Đọc `source._data` là API nội bộ của MapLibre —
    // đã hỏng một lần ở lớp đường đi bộ, không lặp lại.
    this.isoFeatures = fc ? fc.features : null;
    this.isoBands = fc ? fc.features.length : 0;
    return { bands: this.isoBands };
  }

  /** Nét đứt chạy dọc đường đi — làm rõ HƯỚNG đi, không chỉ hình dáng.
      Tắt hoàn toàn khi người dùng yêu cầu giảm chuyển động. */
  _startDash() {
    this._stopDash();
    if (this.reducedMotion() || !this.routeCount) return;
    // Chuỗi nét đứt hai phần tử, độ dài tổng KHÔNG đổi — chỉ dịch pha. Bản
    // trước trộn mảng 3 và 4 phần tử nên tổng chu kỳ thay đổi giữa các khung,
    // và ở mức phóng cao nét đứt trông gãy khúc, dài ngắn thất thường.
    const seq = [[0, 0.4, 2, 1.6], [0, 0.8, 2, 1.2], [0, 1.2, 2, 0.8], [0, 1.6, 2, 0.4],
      [0, 2, 2, 0], [0.4, 2, 1.6, 0], [0.8, 2, 1.2, 0], [1.2, 2, 0.8, 0],
      [1.6, 2, 0.4, 0], [2, 2, 0, 0]];
    let i = 0;
    this._dashTimer = setInterval(() => {
      i = (i + 1) % seq.length;
      try { this.map.setPaintProperty('walk-route', 'line-dasharray', seq[i]); } catch { this._stopDash(); }
    }, 90);
  }

  _stopDash() {
    if (this._dashTimer) { clearInterval(this._dashTimer); this._dashTimer = null; }
  }

  _ringsFor(id) {
    const b = this.buildings.find((x) => x.id === id);
    if (!b) return empty();
    return {
      type: 'FeatureCollection',
      features: [500, 1000].map((r) => ({ type: 'Feature', properties: { r }, geometry: circle(b.lat, b.lng, r) })),
    };
  }

  _paint() {
    for (const entry of this.markers.values()) {
      const el = entry.marker.getElement();
      const selected = entry.ids.includes(this.selectedId);
      const compared = entry.ids.some((id) => this.compareIds.has(id));
      el.classList.toggle('is-selected', selected);
      el.classList.toggle('is-compare', compared);
      el.classList.toggle('is-dim', this.compareIds.size > 0 && !compared);
    }
  }

  /* =======================================================================
     KHUNG NHÌN CÒN THẤY ĐƯỢC

     Bảng thông tin nằm ĐÈ lên bản đồ, không đẩy bản đồ. Cách này giữ được
     nền bản đồ tràn cạnh (bảng trôi trên một mặt phẳng liền), nhưng chỉ
     đúng khi camera biết phần nào đang bị che. Hai việc phải làm cùng nhau:
     đè bảng lên, và trừ bề rộng bảng ra khỏi khung camera.

     Ai cũng làm vậy: Google Maps, Zillow, Citymapper, Uber — tấm thẻ trượt
     lên thì bản đồ đẩy nội dung ra khỏi vùng bị che, không phải người dùng
     tự kéo đi tìm.
     ===================================================================== */
  setViewportPadding(pad) {
    const next = {
      top: Math.round(pad.top || 0), right: Math.round(pad.right || 0),
      bottom: Math.round(pad.bottom || 0), left: Math.round(pad.left || 0),
    };
    const same = ['top', 'right', 'bottom', 'left'].every((k) => this.pad[k] === next[k]);
    if (same) return this.pad;
    this.pad = next;
    // duration 0: đây là cập nhật BỐ CỤC, không phải một chuyển động người
    // dùng yêu cầu. Cho nó chạy hoạt ảnh thì mỗi lần mở bảng bản đồ lại
    // trượt một nhịp không ai xin.
    this.map?.setPadding(next, { duration: 0 });
    this._placeLabels();
    return this.pad;
  }

  /** Hình chữ nhật CÒN THẤY ĐƯỢC, theo pixel của khung vẽ. */
  _visibleBox(inset = 0) {
    const c = this.map.getCanvas();
    const w = c.clientWidth, h = c.clientHeight;
    return {
      l: this.pad.left + inset, t: this.pad.top + inset,
      r: w - this.pad.right - inset, b: h - this.pad.bottom - inset,
    };
  }

  /** Mọi điểm đã nằm gọn trong phần còn thấy được chưa? */
  _allInView(points, inset = 28) {
    if (!points.length) return true;
    const box = this._visibleBox(inset);
    if (box.r - box.l < 80 || box.b - box.t < 80) return true;   // chỗ quá hẹp, đừng đuổi theo
    return points.every(([lng, lat]) => {
      const p = this.map.project([lng, lat]);
      return p.x >= box.l && p.x <= box.r && p.y >= box.t && p.y <= box.b;
    });
  }

  /** Đưa một tập điểm vào phần còn thấy được.
      Lề truyền vào đây chỉ là LỀ THÊM — padding khung nhìn đã được cộng sẵn
      bởi MapLibre (đo được: fitBounds lề 30 trên padding trái 400 cho ra
      cạnh trái ở x=471). */
  _fitPoints(points, { maxZoom = 16.6, margin = 44, force = false } = {}) {
    if (!points.length || !this.map) return false;
    if (!force && this._allInView(points)) return false;
    const lngs = points.map((p) => p[0]), lats = points.map((p) => p[1]);
    const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
    this.map.fitBounds(bounds, {
      padding: margin, maxZoom,
      duration: this.reducedMotion() ? 0 : 520,
    });
    return true;
  }

  /** Đưa TOÀN BỘ tiện ích đang hiện + tòa nhà vào tầm nhìn.

      Đây là câu trả lời cho "gần như không thấy được": trước đây bật một
      nhóm tiện ích không hề đụng tới camera, nên trong sáu địa điểm thì hai
      cái nằm trong khung và bốn cái nằm ngoài mép hoặc dưới bảng. Người
      dùng phải tự đi tìm thứ vừa mới bật lên. */
  fitAmenities(buildingId, { force = true } = {}) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return false;
    const pts = [[b.lng, b.lat]];
    for (const rec of this.routeIndex?.values() || []) pts.push([rec.place.lng, rec.place.lat]);
    // Một mình tòa nhà thì không có gì để "vừa khung" — chỉ cần nó ở giữa.
    if (pts.length === 1) return false;
    /* force MẶC ĐỊNH BẬT: "đã nằm trong khung" chưa phải là đủ.

       Ở mức thành phố mọi thứ đều nằm trong khung — cả sáu địa điểm dồn vào
       một cụm bằng đầu ngón tay ở góc bản đồ, kỹ thuật là "thấy được" nhưng
       không đọc được gì. Vừa khung nghĩa là ĐẦY khung: cụm địa điểm phải
       chiếm phần lớn khoảng còn thấy được, không chỉ lọt vào trong nó.

       Phép thử "đã trong khung thì đứng yên" vẫn còn, nhưng để dành cho
       revealAmenity() — nơi camera KHÔNG được giật dưới con trỏ. */
    return this._fitPoints(pts, { force });
  }

  fitTo(ids) {
    const pts = this.buildings.filter((b) => ids.includes(b.id));
    if (!pts.length) return;
    this._fitPoints(pts.map((b) => [b.lng, b.lat]), { maxZoom: 15, margin: 56, force: true });
  }

  resize() { this.map?.resize(); }
}

/* =========================================================================
   KÝ HIỆU NHÓM TIỆN ÍCH — nét ĐẶC, vẽ riêng cho cỡ 11–14px.

   Vì sao không dùng lại bộ icon nét mảnh của giao diện: icon Lucide vẽ ở
   khung 24px với nét 2px. Thu về 12px thì nét chỉ còn ~1px — mảnh hơn một
   pixel vật lý ở màn hình thường, nên trình duyệt khử răng cưa nó thành một
   vệt xám nhòe. Hình dạng biến mất, chỉ còn "có cái gì đó tròn tròn".

   Bộ này vẽ ở khung 16px, TOÀN NÉT ĐẶC, chi tiết tối thiểu. Đây đúng là
   nguyên tắc của các bộ icon bản đồ mở chuyên dụng — Maki của Mapbox và bản
   mở rộng Temaki, đều CC0, đều dựng ở khung 15px: ở cỡ ghim thì mảng đặc
   đọc được còn đường viền thì không.

   Tự vẽ chứ không nhúng Maki: tám ký hiệu thì công vẽ ít hơn công thêm một
   phụ thuộc mới cùng tệp giấy phép của nó, và bản tự vẽ khớp đúng tám nhóm
   dữ liệu đang có. Cần nhóm thứ chín thì Maki/Temaki là chỗ để lấy.

   Mỗi ký hiệu là MỘT path, fill=currentColor, nên nó thừa hưởng màu nhóm từ
   phần tử cha và không cần biết gì về bảng màu.
   ========================================================================= */
const glyph = (d, evenodd) =>
  '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"'
  + (evenodd ? ' fill-rule="evenodd"' : '') + '><path d="' + d + '"/></svg>';

export const AMENITY_ICONS = {
  // Ăn uống — nĩa ba răng và dao
  utensils: glyph('M3.2 1.9h1.05v3.1h.75V1.9h1.05v3.1h.75V1.9h1.05v3.6c0 .95-.55 1.72-1.32 1.98V14.1H4.52V7.48'
    + 'C3.75 7.22 3.2 6.45 3.2 5.5V1.9Zm8.05 0h.9c1.2 0 2.05 1.6 2.05 3.55 0 1.5-.5 2.72-1.3 3.15v5.5h-1.65V1.9Z'),
  // Trạm xe buýt — đầu xe buýt: kính, thân, hai bánh.
  // Khoá cũ tên `train` trong khi hình vẽ là xe buýt; đổi tên cho khớp nhóm.
  bus: glyph('M4.1 1.9h7.8a1.8 1.8 0 0 1 1.8 1.8v6.7a1.8 1.8 0 0 1-1.2 1.7v1.2a.85.85 0 0 1-1.7 0v-1.05H5.2v1.05'
    + 'a.85.85 0 0 1-1.7 0v-1.2a1.8 1.8 0 0 1-1.2-1.7V3.7a1.8 1.8 0 0 1 1.8-1.8Zm-.1 2.1v3.15h8V4H4Zm1 4.75'
    + 'a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm6 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z', true),
  // Mua sắm — túi xách có quai
  cart: glyph('M8 1.3a3 3 0 0 0-3 3H3.05L2.2 14.3h11.6L12.95 4.3H11a3 3 0 0 0-3-3Zm0 1.7c.72 0 1.3.58 1.3 1.3H6.7'
    + 'c0-.72.58-1.3 1.3-1.3Z', true),
  // Ngân hàng — mái tam giác, ba cột, bệ
  bank: glyph('M8 1.4 14.7 4.9V6.6H1.3V4.9L8 1.4ZM2.9 7.8h1.9v4.1H2.9V7.8Zm4.15 0h1.9v4.1h-1.9V7.8Zm4.15 0h1.9v4.1'
    + 'h-1.9V7.8ZM1.5 13h13v1.6h-13V13Z'),
  // Y tế — chữ thập
  cross: glyph('M6.5 1.9h3v4.6h4.6v3H9.5v4.6h-3V9.5H1.9v-3h4.6V1.9Z'),
  // Thể thao — tạ đôi
  // Thanh nối phải CHỜM lên hai đĩa trong, không chỉ chạm mép: ở cỡ 12px một
  // khe hở nửa pixel cũng làm cái tạ đọc ra thành năm mảng rời.
  dumbbell: glyph('M1.1 5.4H3.1v5.2H1.1V5.4Zm2.5-1.5h2.2v8.2H3.6V3.9Zm2.1 3.1h4.6v2H5.7V7Zm4.5-3.1h2.2v8.2'
    + 'h-2.2V3.9Zm2.6 1.5h2v5.2h-2V5.4Z'),
  // Khách sạn — đầu giường, đệm, gối
  bed: glyph('M1.4 3.1h1.9v9.8H1.4V3.1Zm1.9 4.9h11.3v4.9H3.3V8Zm1.3-2.8h2.3a1.45 1.45 0 1 1 0 2.9H4.6'
    + 'a1.45 1.45 0 1 1 0-2.9Z'),
  // Bãi đỗ xe — chữ P, ký hiệu quốc tế. Ở cỡ 12px nó đọc được chắc chắn hơn
  // bất kỳ hình vẽ chiếc xe nào, và không cần ai học nó lần đầu.
  car: glyph('M3.6 1.7h5.1a3.85 3.85 0 0 1 0 7.7H6.5v4.9H3.6V1.7Zm2.9 2.7v2.3h2.2a1.15 1.15 0 0 0 0-2.3H6.5Z', true),
};

function markerLabel(b) {
  return [
    b.name, `hạng ${b.gradeLabel}`, b.districtLabel,
    isPresent(b.baseRent) ? `${NHAN.giaNgan}: ${money(b.baseRent.value)} USD/m²/tháng` : 'chưa có giá',
    isPresent(b.grossExVat) ? `tổng trước VAT ${money(b.grossExVat.value)}` : null,
    isPresent(b.distanceMetro) ? `cách ga ${b.nearestMetro} ${distance(b.distanceMetro.value)}` : null,
  ].filter(Boolean).join(', ') + '. Nhấn để mở bản xem nhanh.';
}

function stationsGeoJson(stations) {
  return {
    type: 'FeatureCollection',
    features: (stations || []).map((s) => ({
      type: 'Feature',
      properties: { id: s.id, name: s.name },
      geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
    })),
  };
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Ký hiệu cho lớp giao thông — cùng khung 16px, cùng nguyên tắc nét đặc. */
const TRANSIT_ICONS = {
  rail: glyph('M5 1.6h6a2.2 2.2 0 0 1 2.2 2.2v6.4a2.2 2.2 0 0 1-2.2 2.2H5a2.2 2.2 0 0 1-2.2-2.2V3.8'
    + 'A2.2 2.2 0 0 1 5 1.6Zm-.2 2v3.2h6.4V3.6H4.8Zm.9 4.9a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z'
    + 'm4.6 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1ZM4.6 13.1h1.9l-1.3 1.5H3.3l1.3-1.5Zm5 0h1.9'
    + 'l1.3 1.5h-1.9l-1.3-1.5Z', true),
  metro: glyph('M4.6 1.5h6.8a2.1 2.1 0 0 1 2.1 2.1v6.5a2.1 2.1 0 0 1-2.1 2.1H4.6a2.1 2.1 0 0 1-2.1-2.1V3.6'
    + 'a2.1 2.1 0 0 1 2.1-2.1Zm-.2 2.1v3.3h7.2V3.6H4.4Zm1 4.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm5.2 0'
    + 'a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM4.3 13h2L4.9 14.6H2.9L4.3 13Zm5.4 0h2l1.4 1.6h-2L9.7 13Z', true),
  // Mốc CBD: vòng ngắm. Nó là ĐIỂM QUY CHIẾU để đo, không phải một địa
  // điểm để tới — nên không dùng hình ghim.
  cbd: glyph('M8 0.9a7.1 7.1 0 1 0 0 14.2A7.1 7.1 0 0 0 8 .9Zm0 2.1a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z'
    + 'M7.2 4.6h1.6v6.8H7.2V4.6ZM4.6 7.2h6.8v1.6H4.6V7.2Z', true),
  plane: glyph('M8 1.1c.72 0 1.3.72 1.3 1.6v3.15l5.3 3.1v1.7l-5.3-1.6v3.2l1.8 1.25v1.15L8 14.1l-3.1.55'
    + 'V13.5l1.8-1.25v-3.2l-5.3 1.6V8.95l5.3-3.1V2.7c0-.88.58-1.6 1.3-1.6Z'),
};

/* MỘT nguồn sự thật cho "nhóm này còn hiện không" và "địa điểm nào thuộc
   nhóm này". Bảng tiêu điểm và bản đồ trước đây lọc riêng mỗi bên — nên ẩn
   một nhóm ở bản đồ mà bảng bên cạnh vẫn liệt kê nó. */
export function amenityPlaces(key, places) {
  const st = AMENITY_STYLE[key];
  if (!st || st.hidden) return null;
  if (!st.kinds) return places || [];
  const k = new Set(st.kinds);
  return (places || []).filter((p) => k.has(p.kind));
}
export function amenityLabel(key) { return AMENITY_STYLE[key]?.label || key; }

export const AMENITY_CATEGORIES = Object.entries(AMENITY_STYLE)
  .filter(([, v]) => !v.hidden)
  .map(([key, v]) => ({ key, label: v.label, color: v.color, icon: v.icon }));

export const MAP_META = {
  engine: 'MapLibre GL JS 6.5.0 (BSD-3-Clause)',
  basemap: 'OpenFreeMap, dữ liệu OpenStreetMap (ODbL 1.0)',
  metroGeometry: 'OpenStreetMap, tuyến Bến Thành – Suối Tiên',
  markerNote: 'Rê chuột lên một chấm để xem tên, bấm để xem chi tiết.',
  dimension: 'Bản đồ nghiêng được, có khối nhà 3D.',
  noGoogleNote: '',
  openAmenityNote: 'Tiện ích trên bản đồ: OpenStreetMap (ODbL).',
  walkRouteNote: 'Đường đi bộ theo mạng đường OpenStreetMap; không tính đèn tín hiệu hay cầu vượt.',
};
