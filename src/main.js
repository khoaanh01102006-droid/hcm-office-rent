/* =========================================================================
   Property Insight · bản thử 12 tòa pilot — bộ điều khiển ứng dụng
   OFFICE-UX-PILOT-004 · PROPOSED_FOR_REVIEW
   ========================================================================= */

import { loadPilot, defaultFilters, filterBuildings, activeFilterCount, SORTS, isPresent, FieldState } from './data.js';
import { PilotMap, MAP_META, AMENITY_CATEGORIES, AMENITY_ICONS, amenityPlaces, amenityLabel,
  BASEMAPS, BASEMAP_DEFAULT,
  rentScaleOf, RENT_BANDS } from './map.js';
import { icon, amenityIcon } from './icons.js';
import { money, distance, dateShort, num } from './format.js';
import { esc, missingChip, rentBar, gradeBadge, crosscheckChip, metroLine } from './components/primitives.js';
import { renderProfile } from './views/profile.js';
import { renderCompare } from './views/compare.js';
import { renderOverview } from './views/overview.js';
import { renderMarket } from './views/market.js';
import { renderNotes } from './views/notes.js';
import { DAY_DU, NHAN, DUONG_DAN, LINK_407, LINK_DAY_DU, datKyGia } from './che_do.js';
import { storyShell, mountStory, resizeStory } from './views/story.js';
import { googleShell, startGoogle, enrichProfileWithGoogle } from './views/google.js';
import { renderMethod } from './views/method.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  data: null,
  filters: defaultFilters(),
  sort: 'rent_asc',
  visible: [],
  selectedId: null,
  compare: [],
  density: 'cards',        // cards | table
  motion: 'system',
  lastFocus: null,
  scaleMax: 1,
  cmdk: { open: false, index: 0, results: [] },
  /* Ba nhóm bật sẵn, không phải rỗng.

     Với tập rỗng thì lớp tiện ích chỉ hiện khi người dùng TỰ TÌM RA các nút
     nhóm và bấm — tức một tính năng có nhưng không ai thấy. Ba nhóm là đủ
     để lớp này tự giới thiệu mà chưa thành mớ rối: ăn uống và mua sắm là
     thứ hỏi nhiều nhất, đi lại là thứ quyết định nhất với văn phòng.
     Năm nhóm còn lại vẫn ở đó, cách một cú bấm. */
  amenityCats: new Set(['food', 'transit', 'convenience']),
  amenityData: null,
  isoData: null,
  reach: 'ring',
  transitData: null,
  transit: 'full',   // full | metro | off — lớp giao thông trên bản đồ
  areaData: null,
  areas: true,       // ranh giới phường trên bản đồ
  /* MẶC ĐỊNH 'off' — không vẽ tuyến nào cho tới khi người dùng trỏ vào một
     dòng tiện ích. Tên chế độ gây hiểu nhầm: 'off' KHÔNG tắt tính năng, nó
     vẽ đúng tuyến đang được hỏi và ẩn mọi tuyến khác. Bản trước để 'lead',
     tức vẽ sẵn tám tuyến — đúng cái mớ rối người dùng đã than phiền. */
  /* Mặc định 'gần nhất mỗi nhóm', không phải 'off'.
     'off' nghĩa là mở trang lên bấm vào một tòa thì KHÔNG thấy tuyến nào cho
     tới khi tình cờ rê chuột trúng một chấm — trong khi yêu cầu là bấm vào
     tòa phải thấy đường đi tới tiện ích. 'lead' vẽ đúng tuyến tới điểm GẦN
     NHẤT của mỗi nhóm đang bật (mặc định ba nhóm → ba tuyến), không phải cả
     bốn tám tuyến. 'Tất cả' vẫn còn đó cho ai chủ động muốn xem. */
  routeMode: 'lead',
  band: 'normal',     // normal | peak — khung giờ tính thời gian đi bộ        // ring | iso | off — cách hiển thị vùng quanh tòa
  ovMetric: 'gross',    // đại lượng tô màu lưới ô trang tổng quan
  ovLoc: null,          // ô quận/hạng đang lọc bảng danh sách ở trang tổng quan ({ kieu, giaTri })
  focusFor: null,      // tòa nhà bảng tiêu điểm đang dựng cho
  strip: 'off',         // cards | rows | off — băng thẻ dưới bản đồ.
                        // Mặc định TẮT: nó lặp lại đúng tập tòa nhà mà dải bên
                        // trái đã hiện. Bật lại ở "Kiểu" dưới góc phải bản đồ.
};

const theme = () => document.documentElement.dataset.theme || 'light';
const reducedMotion = () =>
  state.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let map;

/* ========================================================================= */
// Khoá lưu 'đã xem hướng dẫn' (xem openGuide). Khai trước init() vì init dùng nó.
const KHOA_HUONG_DAN = 'pi_huong_dan_da_xem';
init().catch((err) => { console.error(err); $('#listscroll').innerHTML = errorState(err); });

async function init() {
  paintIcons();
  $('#listscroll').innerHTML = loadingState();

  state.data = await loadPilot();
  ganCheDo();
  const b = state.data.buildings;
  state.scaleMax = Math.max(1, ...b.map((x) => (
    isPresent(x.grossIncVat) ? x.grossIncVat.value : (isPresent(x.baseRent) ? x.baseRent.value : 0)
  )));

  buildFilterControls();
  buildSortControl();
  buildStripControls();
  buildBasemapControls();
  buildSkinControls();
  wireEvents();

  /* NẠP CÙNG LÚC mọi lớp phụ ngay từ đầu. Trước 30/09 chúng nạp nối nhau sau khi bản đồ dựng xong, mỗi tệp chờ tệp trước:
     đo dưới mạng 4G giả lập, nạp đủ mọi lớp mất 16,3 giây. Thứ tự ÁP DỤNG bên dưới giữ nguyên; lỗi của từng tệp vẫn được bắt
     đúng chỗ dùng (bắt rỗng ở đây chỉ để trình duyệt không báo "lời hứa bị từ chối chưa xử lý" trước khi tới chỗ đó). */
  const napJson = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  const lop = {
    amenity: napJson('./data/osm_amenities.json'), iso: napJson('./data/osm_isochrones.json'),
    density: napJson('./data/osm_density.json'), bus: napJson('./data/osm_bus_network.json'),
    driving: napJson('./data/osm_driving.json'), transit: napJson('./data/osm_transit.json'),
    area: napJson('./data/osm_areas.json'), giaNguon: napJson(DUONG_DAN.gia),
    canXacNhan: napJson('./data/can_xac_nhan.json'),
  };
  Object.values(lop).forEach((x) => x.catch(() => {}));

  map = new PilotMap($('#map'), {
    onSelect: (id) => selectBuilding(id, { from: 'map' }),
    onHover: (id) => setHover(id),
    onCluster: (ids) => showClusterPicker(ids),
    onScaleChange: (sc) => paintRentKey(sc),
    reducedMotion, theme,
  });
  await map.init(b, state.data.metroStations);

  // Lớp tiện ích MỞ từ OpenStreetMap + đường đi bộ thật. Đây là tập dữ liệu
  // KHÁC với tiện ích Google Places trong payload — Google chỉ ở trong hồ sơ.
  try {
    state.amenityData = await lop.amenity;
    map.setAmenityData(state.amenityData);
    buildAmenityControls();
  } catch (err) {
    console.warn('Không nạp được lớp tiện ích mở:', err.message);
  }

  // Isochrone đi bộ 5/10/15 phút — tính offline bằng Dijkstra trên cùng mạng
  // đường với lớp tiện ích, đóng băng vào tệp lúc dựng.
  try {
    state.isoData = await lop.iso;
    map.setIsochroneData(state.isoData);
    buildReachControls();
  } catch (err) {
    console.warn('Không nạp được lớp vùng đi bộ:', err.message);
  }

  // Mật độ tiện ích + entropy đa dạng (cumulative opportunity, Cervero 3D).
  try {
    state.densityData = await lop.density;
  } catch (err) {
    console.warn('Không nạp được lớp mật độ:', err.message);
  }

  /* Mạng TUYẾN xe buýt. Đếm tuyến chứ không đếm trạm: mười trạm của cùng
     một tuyến chỉ là MỘT lựa chọn đi lại. Số trạm nói lên mật độ hạ tầng,
     số tuyến mới nói lên đi được tới bao nhiêu nơi. */
  try {
    state.busNetwork = await lop.bus;
  } catch (err) {
    console.warn('Không nạp được mạng tuyến xe buýt:', err.message);
  }

  // Lái xe: quãng đường OSRM trên dữ liệu OSM + dải tốc độ quan sát.
  try {
    state.drivingData = await lop.driving;
  } catch (err) {
    console.warn('Không nạp được lớp lái xe OSM:', err.message);
  }

  checkWalkLayerCoverage();
  /* Lớp giao thông — xe buýt, đường sắt quốc gia, metro đang xây, sân bay.
     Bật sẵn: người dùng than "tuyến metro nằm khá riêng lẻ", và mặc định TẮT
     một lớp mạng lưới thì lời than đó vẫn đúng với mọi người mở lần đầu. */
  try {
    state.transitData = await lop.transit;
    map.setTransitData(state.transitData);
    map.setTransitMode(state.transit);
    buildTransitControls();
  } catch (err) {
    console.warn('Không nạp được lớp giao thông:', err.message);
  }

  /* Lớp khu vực — 235 phường TP.HCM + mốc CBD.
     Bật sẵn: ảnh vệ tinh mang rất nhiều chi tiết thật và chi tiết thật không
     có thứ bậc, nên người đọc mất mốc định vị. Ranh giới mờ trả lại thứ bậc đó. */
  try {
    state.areaData = await lop.area;
    const wardCounts = new Map();
    for (const building of b) {
      if (building.currentWard) wardCounts.set(building.currentWard, (wardCounts.get(building.currentWard) || 0) + 1);
    }
    for (const feature of state.areaData?.layers?.wards?.features || []) {
      const count = wardCounts.get(feature.properties?.name) || 0;
      feature.properties.buildingCount = count;
      feature.properties.hasBuildings = count > 0;
    }
    map.setAreaData(state.areaData);
    map.setAreasVisible(state.areas);
    buildAreaControls();
  } catch (err) {
    console.warn('Không nạp được lớp khu vực:', err.message);
  }

  // Giá nhiều nguồn cho trang chi tiết toà (n32_gia_nhieu_nguon.py); thiếu tệp thì trang chi tiết chỉ hiện giá bộ dữ liệu.
  try { state.giaNguon = await lop.giaNguon; } catch (err) { console.warn('Không nạp được giá nhiều nguồn:', err.message); }
  try { state.canXacNhan = await lop.canXacNhan; } catch (err) { console.warn('Không nạp được danh sách cần xác nhận:', err.message); }

  $('#legend-note').textContent = MAP_META.markerNote;

  watchFocusSize();
  syncMapPadding();
  apply({ fit: true });

  // Lần đầu vào thì mở hướng dẫn. Trình duyệt chặn lưu trữ thì coi như đã xem, để không hiện lại mỗi lần tải trang.
  let daXem = true;
  try { daXem = localStorage.getItem(KHOA_HUONG_DAN) === '1'; } catch { /* giữ true */ }
  if (!daXem) openGuide();
}

/* HƯỚNG DẪN cho người mới vào (nang_cap/06_QUY_UOC_VIET_PI.md, quy tắc 7): trả lời trong vài giây
   đây là gì, màu trên bản đồ nghĩa là gì, bấm vào đâu để xem một tòa. Dùng lại bảng bên (#sheet)
   nên có sẵn khoá tiêu điểm, phím Esc và nút đóng. */
function openGuide() {
  state.lastFocus = document.activeElement;
  $('#sheet-title').textContent = 'Hướng dẫn';
  $('#sheet-body').innerHTML = `<div class="pf">
    <section class="pf__sec pf__sec--lead">
      <p class="ov__lede">Property Insight tổng hợp ${state.data.buildings.length} tòa văn phòng tại TP.HCM: ${esc(NHAN.giaDai)}${DAY_DU
    ? '. Đây là phiên bản đầy đủ: 407 tòa của bộ dữ liệu và các tòa trên trang rao; bấm "407 tòa" ở giữa thanh trên để về bản chính.'
    : ', cùng tỷ lệ lấp đầy và vị trí.'}</p>
      <ol class="method__steps">
        <li><span>01</span><div>Trên bản đồ, mỗi chấm là một tòa nhà, màu theo mức giá thuê (xem thang màu trên bản đồ).
          Vòng tròn có số là nhóm tòa gần nhau; bấm vào để phóng to.</div></li>
        <li><span>02</span><div>Bấm một tòa để xem giá, tỷ lệ lấp đầy, tiện ích và thời gian đi lại xung quanh.</div></li>
        <li><span>03</span><div>Dùng bộ lọc ở cột trái để chọn quận, hạng, giá thuê hoặc khoảng cách tới metro.</div></li>
        <li><span>04</span><div>Các tab trên cùng: Danh sách, Tổng quan (số liệu chung), Biến động (giá chào trên trang rao)
          và Kể chuyện (metro và xe buýt).</div></li>
      </ol>
    </section>
    <section class="pf__sec">
      <p class="pf__note">Cách tính và nguồn dữ liệu ở trang Phương pháp. Mở lại hướng dẫn bằng nút "Hướng dẫn" trên cùng.</p>
      <button class="btn btn--primary" type="button" data-guide-close>Xem bản đồ</button>
    </section>
  </div>`;
  $('#sheet-body [data-guide-close]')?.addEventListener('click', closeLayers);
  openLayer($('#sheet'));
  $('#sheet-body').scrollTop = 0;
  $('#sheet-body').focus();
  try { localStorage.setItem(KHOA_HUONG_DAN, '1'); } catch { /* không lưu được: lần sau không tự mở, xem ghi chú ở init */ }
}

function paintIcons() {
  const set = (id, name, size = 14) => { const el = $(id); if (el) el.innerHTML = icon(name, { size }); };
  set('#ic-search', 'search', 15);
  set('#ic-ward-search', 'search', 14);
  set('#ic-search-m', 'search', 16);
  set('#ic-filter', 'filter');
  set('#ic-method', 'info');
  set('#ic-help', 'mapPin');
  set('#ic-motion', 'motion');
  set('#ic-theme', theme() === 'dark' ? 'sun' : 'moon');
  set('#ic-density', 'list');
  set('#ic-amfold', 'chevronUp', 13);
  set('#ic-layers', 'layers', 13);
  set('#ic-goregion', 'mapPin', 13);
  set('#ic-cmdk', 'search', 16);
  set('#ic-close1', 'close');
  set('#ic-close2', 'close');
}

/* ========================================================================= */
/*  Bộ lọc                                                                    */
/* ========================================================================= */

function buildFilterControls() {
  const b = state.data.buildings;

  buildRegionPicker();
  wireRegionJump();

  const grades = [...new Set(b.map((x) => x.grade))]
    .sort((x, y) => b.find((i) => i.grade === x).gradeOrder - b.find((i) => i.grade === y).gradeOrder);
  $('#f-grade').innerHTML = grades.map((g) => {
    const n = b.filter((x) => x.grade === g).length;
    return `<button class="togglechip" type="button" data-grade="${esc(g)}" aria-pressed="false">
      ${esc(b.find((x) => x.grade === g).gradeLabel)}<span class="togglechip__n">${n}</span></button>`;
  }).join('');

  const rents = b.map((x) => x.baseRent.value).filter((v) => v != null);
  const metros = b.map((x) => x.distanceMetro.value).filter((v) => v != null);
  const rent = $('#f-rent');
  rent.min = Math.floor(Math.min(...rents)); rent.max = Math.ceil(Math.max(...rents)); rent.value = rent.max;
  const metro = $('#f-metro');
  metro.min = Math.floor(Math.min(...metros) / 100) * 100;
  metro.max = Math.ceil(Math.max(...metros) / 100) * 100;
  metro.value = metro.max;
  paintSliderLabels();
}

function paintSliderLabels() {
  const rent = $('#f-rent'), metro = $('#f-metro');
  $('#f-rent-val').textContent = Number(rent.value) >= Number(rent.max) ? 'Không giới hạn' : `≤ ${money(Number(rent.value))} USD/m²`;
  $('#f-metro-val').textContent = Number(metro.value) >= Number(metro.max) ? 'Không giới hạn' : `≤ ${distance(Number(metro.value))}`;
}

function readFilters() {
  const f = state.filters;
  f.grades = new Set($$('#f-grade [aria-pressed="true"]').map((el) => el.dataset.grade));
  f.submarkets = new Set($$('[data-sub][aria-pressed="true"]').map((el) => el.dataset.sub));
  f.legacyDistricts = new Set($$('[data-legacy][aria-pressed="true"]').map((el) => el.dataset.legacy));
  f.currentWards = new Set($$('#f-current-ward [aria-pressed="true"]').map((el) => el.dataset.ward));
  const rent = $('#f-rent'), metro = $('#f-metro');
  f.rentMax = Number(rent.value) >= Number(rent.max) ? null : Number(rent.value);
  f.metroMax = Number(metro.value) >= Number(metro.max) ? null : Number(metro.value);
  f.onlyTwoSourcePrice = $('#f-twosource').checked;
}

/* ========================================================================= */
/*  Lọc → danh sách + bản đồ                                                 */
/* ========================================================================= */

function apply({ fit = false } = {}) {
  readFilters();
  paintSliderLabels();

  const all = state.data.buildings;
  const list = filterBuildings(all, state.filters).sort(SORTS[state.sort].cmp);
  state.visible = list;

  // Thang giá tính TRƯỚC khi vẽ danh sách, trên đúng tập vừa lọc. Bản đồ gọi
  // cùng hàm này trên cùng tập nên hai bề mặt luôn cho cùng một bậc cho cùng
  // một tòa — không thể xảy ra chuyện chấm đậm trên bản đồ mà huy hiệu nhạt
  // trong danh sách.
  state.rentScale = rentScaleOf(list);

  const n = activeFilterCount(state.filters);
  const badge = $('#filter-n');
  badge.hidden = n === 0; badge.textContent = n;
  $('#btn-clear').hidden = n === 0;
  // Tóm tắt chỉ kể những trục ĐANG dùng. Bản trước luôn in cả hai kể cả khi
  // một trục bằng 0, ra "0 khu vực cũ · 1 phường/xã" — đọc như một lỗi.
  const parts = [];
  const { submarkets, legacyDistricts, currentWards } = state.filters;
  if (submarkets.size) parts.push(`${submarkets.size} cụm`);
  if (legacyDistricts.size) parts.push(`${legacyDistricts.size} quận cũ`);
  if (currentWards.size) parts.push(`${currentWards.size} phường/xã`);
  $('#region-summary').textContent = parts.length ? parts.join(' · ') : 'Toàn TP.HCM';

  $('#list-count').textContent = `${list.length.toLocaleString('vi-VN')} tòa nhà`;
  $('#list-sub').textContent = (list.length === all.length ? 'tất cả' : `trong ${all.length} tòa`)
    + ' · ' + NHAN.giaNgan;

  renderList(list);
  map?.setBuildings(list.map((x) => x.id));
  if (fit && list.length) map?.fitTo(list.map((x) => x.id));

  announce(`${list.length} tòa nhà khớp bộ lọc, trong tổng số ${all.length} tòa.`);
}

/* ========================================================================= */
/*  Danh sách — hai mật độ: thẻ (mặc định) và bảng dày                        */
/* ========================================================================= */

function renderList(list) {
  const el = $('#listscroll');
  renderStrip(list);
  if (!list.length) { el.innerHTML = emptyState(); el.className = 'listscroll'; return; }
  if (state.density === 'table') {
    el.className = 'tablewrap';
    el.innerHTML = tableHtml(list);
  } else {
    el.className = 'listscroll';
    el.innerHTML = list.map(itemHtml).join('');
  }
}

/* =========================================================================
   Băng thẻ dưới bản đồ

   Ba kiểu, đổi được ngay trong ứng dụng thật thay vì chọn theo ảnh mẫu:

     "Thẻ có ảnh"  ảnh 72px + giá + tên + ga metro. Nhận ra tòa quen ngay,
                   nhưng mỗi thẻ chiếm 250px nên chỉ thấy 4–5 tòa cùng lúc.
     "Dải gọn"     một dòng: giá · tên · phút tới ga. Thấy gần hết 12 tòa
                   cùng lúc, nhưng không có mỏ neo thị giác.
     "Ẩn"          trả toàn bộ chiều cao lại cho bản đồ.

   Băng thẻ và danh sách bên trái là CÙNG một tập đã lọc, cùng thứ tự sắp
   xếp. Bấm một thẻ = chọn tòa đó ở mọi bề mặt.
   ========================================================================= */
function renderStrip(list) {
  const strip = $('#filmstrip');
  if (!strip) return;
  const mode = state.strip || 'cards';
  strip.hidden = mode === 'off' || !list.length;
  document.body.dataset.strip = strip.hidden ? 'off' : mode;
  if (strip.hidden) return;

  $('#strip-count').textContent = `${list.length} tòa · cuộn ngang`;
  const track = $('#strip-track');
  track.dataset.mode = mode;
  track.innerHTML = list.map((b) => stripItem(b, mode)).join('');
}

function stripItem(b, mode) {
  const on = state.selectedId === b.id;
  const price = isPresent(b.baseRent) ? money(b.baseRent.value) : null;
  const metro = isPresent(b.distanceMetro)
    ? `${esc(b.nearestMetro)} · ${esc(distance(b.distanceMetro.value))}` : null;

  // Nhãn đầy đủ nằm ở aria-label vì thẻ bị cắt chữ khi hẹp; trình đọc màn
  // hình phải nghe được cả những gì mắt không đọc hết.
  const label = `${b.name}, hạng ${b.gradeLabel}`
    + (price ? `, ${NHAN.giaNgan}: ${money(b.baseRent.value)} USD/m²/tháng` : ', chưa có giá')
    + (metro ? `, cách ga ${b.nearestMetro} ${distance(b.distanceMetro.value)}` : '');

  if (mode === 'rows') {
    return `<div role="listitem"><button class="scard scard--row ${on ? 'is-on' : ''}" type="button"
      data-stripid="${esc(b.id)}" aria-current="${on}" aria-label="${esc(label)}">
      <span class="scard__price">${price ? esc(price) : '—'}</span>
      <span class="scard__name">${esc(b.name)}</span>
      <span class="scard__meta">${metro ? esc(metro) : ''}</span>
    </button></div>`;
  }

  return `<div role="listitem"><button class="scard ${on ? 'is-on' : ''}" type="button"
    data-stripid="${esc(b.id)}" aria-current="${on}" aria-label="${esc(label)}">
    ${b.image
    ? `<img class="scard__img" src="${esc(b.image.localUrl)}" alt="">`
    : '<span class="scard__img scard__img--none" aria-hidden="true"></span>'}
    <span class="scard__body">
      <span class="scard__top">
        <span class="scard__price">${price ? esc(price) : '—'}</span>
        <span class="scard__unit">USD/m²</span>
        <span class="badge scard__grade">${esc(b.gradeLabel.replace('Hạng ', ''))}</span>
      </span>
      <span class="scard__name">${esc(b.name)}</span>
      <span class="scard__meta">${metro ? esc(metro) : 'chưa có khoảng cách'}</span>
    </span>
  </button></div>`;
}

/* Chọn nền bản đồ.

   Ba nền đầu dựng từ tệp GeoJSON đóng băng: không gọi mạng. Ba nền sau là
   ảnh ô từ máy chủ ngoài — nhiều chi tiết hơn hẳn nhưng CẦN MẠNG, và mỗi
   nguồn có yêu cầu ghi công riêng mà MapLibre tự hiển thị từ thuộc tính
   attribution của nguồn.

   Mặc định là nền ngoại tuyến, nên bản thử vẫn không gọi ra ngoài cho tới
   khi người dùng tự chọn — kiểm thử H-2 giữ nguyên hiệu lực. */
/* =========================================================================
   Bộ chọn giao diện

   Bốn giao diện chỉ định nghĩa lại TOKEN, không đụng bố cục. Đổi giao diện
   phải kéo theo hai thứ: bản đồ dựng lại bảng màu (nó đọc màu từ JS chứ
   không từ CSS), và trang tổng quan vẽ lại (thang màu ô nằm trong style
   nội tuyến).
   ========================================================================= */
const SKINS = [
  { id: '', label: 'Biên tập',
    note: 'Tiêu đề chữ có chân, góc vuông',
    sw: ['#EEF1EE', '#0F1A16'] },
  { id: 'minimal', label: 'Tối giản',
    note: 'Một kiểu chữ, góc bo tròn, thoáng hơn',
    sw: ['#F4F4F5', '#18181B'] },
];

function buildSkinControls() {
  const wrap = $('#skin-opts');
  if (!wrap) return;
  const cur = localStorage.getItem('pi-skin') || '';
  applySkin(cur, { silent: true });

  wrap.innerHTML = SKINS.map((s) => `
    <button class="skinbtn" type="button" role="radio" data-skin="${esc(s.id)}"
      aria-checked="${s.id === cur}" title="${esc(s.label)} — ${esc(s.note)}"
      aria-label="Giao diện ${esc(s.label)}. ${esc(s.note)}.">
      ${s.sw.map((c) => `<i style="background:${esc(c)}"></i>`).join('')}
    </button>`).join('');

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-skin]');
    if (!btn) return;
    applySkin(btn.dataset.skin);
    $$('[data-skin]').forEach((x) => x.setAttribute('aria-checked', String(x === btn)));
  });
}

function applySkin(id, { silent = false } = {}) {
  const s = SKINS.find((x) => x.id === id) || SKINS[0];
  if (s.id) document.documentElement.dataset.skin = s.id;
  else delete document.documentElement.dataset.skin;
  try { localStorage.setItem('pi-skin', s.id); } catch { /* bị chặn: bỏ qua */ }
  if (silent) return;

  // Bản đồ đọc màu từ hằng số JS, không từ CSS — phải dựng lại kiểu.
  map?.setTheme();
  // Thang màu ô của trang tổng quan nằm trong style nội tuyến — vẽ lại.
  paintOverview();
  announce(`Đã đổi sang giao diện ${s.label}. ${s.note}.`);
}

/* Công tắc phiên bản ở giữa thanh trên (01/10). Đổi phiên bản = tải lại trang (che_do.js), nên ở đây chỉ đánh dấu nút đang chọn
   và đổi những chữ tĩnh trong index.html cho đúng phiên bản. Chế độ chia sẻ (bản công khai) chưa có phiên bản đầy đủ: ẩn công tắc. */
function ganCheDo() {
  datKyGia(state.data.banDayDu?.ky_gia);
  const n = state.data.buildings.length;
  $('#ban-407')?.setAttribute('href', LINK_407);
  $('#ban-day-du')?.setAttribute('href', LINK_DAY_DU);
  $(DAY_DU ? '#ban-day-du' : '#ban-407')?.setAttribute('aria-current', 'page');
  // Ô ghi chú cỡ mẫu ở thanh trên nói đúng điều công tắc đã nói (số tòa + loại giá), lại làm chật thanh: ẩn đi khi có công tắc.
  const sn = $('.samplenote');
  if (sn && $('#banpick')) sn.style.display = 'none';
  $('#ban-407-so') && ($('#ban-407-so').textContent = `giá niêm yết 03/2026`);
  if (DAY_DU) {
    const dd = state.data.banDayDu || {};
    $('#ban-day-du-so') && ($('#ban-day-du-so').textContent = `${n.toLocaleString('vi-VN')} tòa · ${NHAN.giaNgan}`);
    $('#f-rent-hint') && ($('#f-rent-hint').textContent = `${NHAN.giaTieuDe}, USD/m²/tháng`);
    const lk = $('#rentkey-title');
    if (lk) lk.textContent = `${NHAN.giaTieuDe} · màu trên bản đồ`;
    $('#overview')?.setAttribute('aria-label', `Tổng quan ${n} tòa nhà, phiên bản đầy đủ`);
    // Kể chuyện dựng riêng trên 407 tòa (đi lại bằng giao thông công cộng): chỉ có ở bản chính.
    const ke = $('#view-story');
    if (ke) ke.hidden = true;
    document.body.dataset.ban = 'day_du';
    announce(`Phiên bản đầy đủ: ${n} tòa (${dd.toa_407 || 407} tòa của bộ dữ liệu và ${dd.toa_trang_rao || n - 407} tòa trên trang rao), ${NHAN.giaNgan}.`);
  }
  import('../config.local.js').then((c) => {
    if (c.SHARE_MODE) { const bp = $('#banpick'); if (bp) bp.hidden = true; if (sn) sn.style.display = ''; }
  }).catch(() => {});
}

function buildBasemapControls() {
  const wrap = $('#base-opts');
  if (!wrap) return;
  const nen = DAY_DU ? Object.entries(BASEMAPS).filter(([, b]) => b.google) : Object.entries(BASEMAPS);
  const macDinh = DAY_DU ? 'google-roadmap' : BASEMAP_DEFAULT;
  wrap.innerHTML = nen.map(([id, b]) => {
    const on = id === macDinh;
    return `<button class="baseopt ${b.kind === 'raster' ? 'is-online' : ''}" type="button"
      role="radio" aria-checked="${on}" data-base="${esc(id)}"
      title="${esc(b.note)}">${esc(b.label)}</button>`;
  }).join('');
  $('#base-note').textContent = DAY_DU
    ? 'Phiên bản đầy đủ chỉ dùng nền Google: vị trí tòa trên trang rao lấy từ Google Maps, điều khoản của Google không cho vẽ trên nền khác.'
    : BASEMAPS[BASEMAP_DEFAULT].note;

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-base]');
    if (!btn) return;
    const id = btn.dataset.base;
    map?.setBasemap(id);
    $$('[data-base]').forEach((x) => x.setAttribute('aria-checked', String(x === btn)));
    $('#base-note').textContent = BASEMAPS[id].note;
    announce(`Đã đổi nền bản đồ sang ${BASEMAPS[id].label}. ${BASEMAPS[id].note}`);
  });
}

function buildStripControls() {
  const strip = $('#filmstrip');
  if (!strip) return;
  strip.querySelector('.seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-strip]');
    if (!btn) return;
    state.strip = btn.dataset.strip;
    $$('[data-strip]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
    renderStrip(state.visible);
    setTimeout(() => { map?.resize(); syncMapPadding(); }, 60);
  });

  $('#strip-track')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stripid]');
    if (btn) selectBuilding(btn.dataset.stripid);
  });
}

function itemHtml(b) {
  const inCompare = state.compare.includes(b.id);
  // Mẫu "nút phủ kín": thẻ KHÔNG mang role=button. Nút mở hồ sơ là một
  // <button> trong suốt phủ toàn thẻ, và nút so sánh nằm cạnh nó — nên không
  // có phần tử tương tác nào lồng trong phần tử tương tác khác (WCAG 4.1.2).
  return `<div role="listitem">
    <div class="item ${state.selectedId === b.id ? 'is-active' : ''}" data-id="${esc(b.id)}">
      <button class="item__open" type="button" data-act="open" data-id="${esc(b.id)}"
        aria-label="${esc(itemLabel(b))}"${state.selectedId === b.id ? ' aria-current="true"' : ''}>
        Xem ${esc(b.name)}
      </button>

      ${b.image ? `<img class="item__thumb" src="${esc(b.image.localUrl)}" alt=""
        loading="lazy" decoding="async" width="72" height="72">`
    : '<span class="item__thumb item__thumb--none" aria-hidden="true"></span>'}

      <div class="item__top">
        <span class="item__name">${esc(b.name)}</span>
        ${gradeBadge(b, { withNote: false })}
      </div>

      <div class="item__price">
        ${isPresent(b.baseRent)
          ? `<span class="item__num">${esc(money(b.baseRent.value))}</span>${rentBandChip(b)}`
          : missingChip(b.baseRent.state)}
        ${isPresent(b.grossExVat)
          ? `<span class="item__gross"><b>${esc(money(b.grossExVat.value))}</b> trước VAT</span>` : ''}
      </div>

      <div class="item__bar">${rentPosBar(b)}</div>

      <div class="item__rows">
        <div class="item__row">${icon('mapPin', { size: 13 })}<span>${esc(b.address)}</span></div>
        <div class="item__row">${icon('train', { size: 13 })}<span>${isPresent(b.distanceMetro)
          ? `Ga ${esc(b.nearestMetro)} · <b>${esc(distance(b.distanceMetro.value))}</b>`
          : 'Chưa có khoảng cách tới metro'}</span></div>
        ${driveRow(b)}
      </div>

      <button class="item__cmp" type="button" data-act="compare" data-id="${esc(b.id)}" aria-pressed="${inCompare}"
        aria-label="${inCompare ? 'Bỏ' : 'Thêm'} ${esc(b.name)} ${inCompare ? 'khỏi' : 'vào'} khay so sánh">
        ${icon(inCompare ? 'check' : 'scale', { size: 13 })}
      </button>
    </div>
  </div>`;
}

/* Bảng dày: cùng dữ liệu, cùng bộ lọc — và là con đường mở rộng lên 407 hồ sơ
   mà không phải dựng 407 thẻ chi tiết cùng lúc. */
function tableHtml(list) {
  return `<table class="dtable">
    <caption class="sr-only">Danh sách ${list.length} tòa nhà, dạng bảng.</caption>
    <thead><tr>
      <th scope="col">Tòa nhà</th><th scope="col">Hạng</th>
      <th scope="col" style="text-align:right">Giá thuê 03/2026</th>
      <th scope="col" style="text-align:right">Lấp đầy</th>
      <th scope="col" style="text-align:right">Cách metro</th>
    </tr></thead>
    <tbody>
      ${list.map((b) => `<tr data-id="${esc(b.id)}" tabindex="0" class="${state.selectedId === b.id ? 'is-active' : ''}"
        aria-label="${esc(itemLabel(b))}">
        <td>${esc(b.name)}</td>
        <td>${esc(b.gradeLabel)}</td>
        <td class="num">${isPresent(b.baseRent) ? esc(money(b.baseRent.value)) : '—'}</td>
        <td class="num">${isPresent(b.occupancy) ? `${esc(money(b.occupancy.value))}%` : '—'}</td>
        <td class="num">${isPresent(b.distanceMetro) ? esc(distance(b.distanceMetro.value)) : '—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function itemLabel(b) {
  return [
    b.name, `hạng ${b.gradeLabel}`, b.districtLabel,
    isPresent(b.baseRent) ? `${NHAN.giaNgan}: ${money(b.baseRent.value)} USD/m²/tháng` : 'chưa có giá',
    isPresent(b.grossExVat) ? `tổng trước VAT ${money(b.grossExVat.value)}` : null,
    isPresent(b.distanceMetro) ? `cách ga ${b.nearestMetro} ${distance(b.distanceMetro.value)}` : null,
  ].filter(Boolean).join(', ') + '.';
}

/* ---- Bốn trạng thái ----------------------------------------------------- */
function loadingState() {
  return `<div role="status" aria-live="polite" style="display:flex;flex-direction:column;gap:var(--s-2)">
    <span class="sr-only">Đang nạp dữ liệu tòa nhà và bản đồ.</span>
    ${'<div class="skel" aria-hidden="true"></div>'.repeat(4)}
  </div>`;
}
function emptyState() {
  return `<div class="state">
    <span class="state__ic">${icon('search', { size: 20 })}</span>
    <h4>Không tòa nào khớp bộ lọc</h4>
    <p>Thử bỏ bớt một điều kiện lọc.</p>
    <button class="btn btn--outline" type="button" data-act="clear">Xóa bộ lọc</button>
  </div>`;
}
function errorState(err) {
  return `<div class="state" role="alert">
    <span class="state__ic">${icon('alert', { size: 20 })}</span>
    <h4>Không nạp được dữ liệu</h4>
    <p>Hãy tải lại trang. Chi tiết: ${esc(err && err.message)}</p>
  </div>`;
}

/* ========================================================================= */
/*  Chọn, rê, so sánh                                                        */
/* ========================================================================= */

function selectBuilding(id, { from, fly = true } = {}) {
  state.selectedId = id;
  $$('.item, .dtable tbody tr').forEach((c) => c.classList.toggle('is-active', c.dataset.id === id));
  $$('.item__open').forEach((btn) => {
    if (btn.dataset.id === id) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
  // Bảng tiêu điểm phải dựng TRƯỚC lệnh camera: camera đọc bề rộng bảng để
  // biết phần nào của bản đồ đang bị che. Ngược thứ tự thì lần bay đầu tiên
  // căn theo một khung nhìn chưa có bảng, và tòa nhà dừng lệch sang trái.
  renderFocus();
  /* MỘT lệnh camera cho mỗi lần chọn, không phải hai.

     Nếu đang bật nhóm tiện ích thì fitAmenities() ngay sau đây mới là lệnh
     đúng — nó đưa cả tòa nhà LẪN các địa điểm vào khung. Bay tới tâm tòa
     nhà trước rồi vừa-khung sau là hai chuyển động chồng lên nhau: cái thứ
     hai cắt ngang cái thứ nhất, và mắt đọc ra một cú giật. */
  /* BAY THẲNG TỚI TÒA NHÀ, luôn luôn.

     Bản trước hoãn lệnh camera lại cho fitAmenities() khi có lớp tiện ích
     bật — ý tưởng là đưa cả tòa nhà lẫn các tiện ích vào khung trong MỘT
     chuyển động. Nhưng đường đó gián tiếp qua ba hàm và khi routeIndex chưa
     kịp dựng thì KHÔNG CÓ lệnh camera nào chạy cả: bấm vào một tòa và bản
     đồ đứng yên. Người dùng gặp đúng điều đó với New City Building.

     Kỳ vọng đơn giản hơn nhiều: bấm vào tòa nào thì tới tòa đó. Việc ôm
     trọn tòa nhà lẫn một tiện ích vẫn còn — nhưng chỉ khi người dùng BẤM
     một dòng tiện ích, tức khi họ hỏi đúng câu đó (fitToPair).

     Bấm từ chính bản đồ thì không bay: ghim đã ở dưới con trỏ rồi, giật
     camera lúc đó là cướp mất ngữ cảnh người ta vừa tự tìm ra. */
  if (from !== 'map') map?.setSelected(id, { fly });
  else map?.setSelected(id, { fly: false });
  $$('.scard').forEach((c) => {
    const on = c.dataset.stripid === id;
    c.classList.toggle('is-on', on);
    c.setAttribute('aria-current', String(on));
    if (on) c.scrollIntoView({ inline: 'center', block: 'nearest',
      behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  paintAmenities();
  paintOverview();
  if (from === 'map' && id) {
    $(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

function setHover(id) {
  $$('.item').forEach((c) => c.classList.toggle('is-hover', c.dataset.id === id));
}

/* =========================================================================
   BẢNG TIÊU ĐIỂM — thông tin tòa nhà, nay neo cạnh thay vì thả nổi

   Nội dung ở đây trước nằm trong thẻ popup nổi giữa bản đồ. Nó vẫn hữu ích
   như cũ — vấn đề chưa bao giờ là nội dung, mà là CHỖ ĐỨNG: một tấm thẻ
   300px thả giữa khung, cộng bảng tiện ích 348px ở cạnh trái, phủ đúng
   khoảng bản đồ mà các tuyến đi bộ chiếm.

   Nay cả hai là một bảng, neo một chỗ, và camera trừ chỗ đó ra.
   ========================================================================= */
function renderFocus() {
  const host = $('#focus');
  if (!host) return;
  const b = state.selectedId && state.data.buildings.find((x) => x.id === state.selectedId);
  host.hidden = !b;
  $('.mapcol')?.classList.toggle('has-focus', !!b);
  if (!b) {
    $('#focus-building').innerHTML = '';
    $('#focus-stub').textContent = '';
    syncMapPadding();
    return;
  }

  /* ĐẦU BẢNG CỐ Ý GỌN.

     Ảnh lớn 132px cộng bốn dòng siêu dữ liệu đẩy danh sách tiện ích xuống
     dưới mép màn hình: mở lớp tiện ích ra mà thứ đầu tiên đọc được lại là
     những thông tin ĐÃ CÓ NGUYÊN VĂN trên thẻ bên trái — ảnh, tên, địa chỉ,
     giá, ga metro, kết quả đối chiếu.

     Ở đây chỉ giữ phần KHÔNG lặp lại: xác nhận bảng đang nói về tòa nào,
     con số giá, và hai lối đi tiếp. Phần còn lại nằm trong hồ sơ, cách một
     cú bấm. Nhờ vậy dòng tiện ích đầu tiên lên trên mép gập. */
  const airportM = isPresent(b.distanceAirport) ? b.distanceAirport.value : null;
  const meta = [
    isPresent(b.distanceMetro)
      ? { ic: 'train', html: `Ga ${esc(b.nearestMetro)} · <b>${esc(distance(b.distanceMetro.value))}</b>` }
      : null,
    // Khoảng cách sân bay là thứ người thuê văn phòng hỏi thật, và nó KHÔNG
    // suy ra được từ bản đồ vì sân bay nằm ngoài khung ở mọi mức phóng có
    // ích. Ghi rõ "chim bay": bản thử không có đồ thị đường cho xe cơ giới
    // nên mọi con số "phút tới sân bay" sẽ là ước đoán không kiểm chứng được.
    // Mốc CBD giải ngược từ chính distanceCbdM nên ghim trên bản đồ và con số
    // ở đây nói về CÙNG một điểm. Ghi "chim bay" vì đó đúng là đường thẳng.
    isPresent(b.distanceCbd)
      ? { ic: 'target', html: `Trung tâm <b>${esc(distance(b.distanceCbd.value))}</b>` }
      : null,
    airportM != null
      ? { ic: 'map', html: `Sân bay <b>${esc(String(Math.round(airportM / 100) / 10).replace('.', ','))} km</b>` }
      : null,
  ].filter(Boolean);

  $('#focus-stub').textContent = b.name;
  // Đổi tòa nhà thì bảng phải bắt đầu lại từ đầu. Giữ nguyên vị trí cuộn cũ
  // làm tòa mới mở ra ở giữa danh sách tiện ích, không thấy cả tên tòa.
  if (state.focusFor !== b.id) { $('#focus-scroll').scrollTop = 0; state.focusFor = b.id; }
  $('#focus-building').innerHTML = `
    <div class="fbuild__id">
      ${b.image ? `<img class="fbuild__thumb" src="${esc(b.image.localUrl)}" alt=""
        loading="lazy" decoding="async">` : ''}
      <div class="fbuild__idtext">
        <h3 class="fbuild__name">${esc(b.name)}</h3>
        <p class="fbuild__addr">${esc(b.address)}</p>
      </div>
    </div>
    <div class="fbuild__price">
      <span class="fbuild__num">${isPresent(b.baseRent) ? esc(money(b.baseRent.value)) : '—'}</span>
      <span class="fbuild__unit">USD/m²/tháng · ${esc(NHAN.giaNgan)}, ${esc(NHAN.giaCoSo)}</span>
      ${isPresent(b.grossExVat)
    ? `<span class="fbuild__gross">tổng trước VAT <b>${esc(money(b.grossExVat.value))}</b></span>` : ''}
    </div>
    <div class="fbuild__meta">
      ${gradeBadge(b, { withNote: false })}
      ${meta.map((r) => `<span class="fbuild__chip">${icon(r.ic, { size: 12 })}${r.html}</span>`).join('')}
    </div>
    <div class="fbuild__coord">
      ${Number.isFinite(b.lat) && Number.isFinite(b.lng)
    ? `<a href="https://www.google.com/maps/search/?api=1&query=${b.lat.toFixed(7)},${b.lng.toFixed(7)}"
        target="_blank" rel="noopener noreferrer"
        title="Mở vị trí trên Google Maps">
        ${icon('target', { size: 12 })}<code>${b.lat.toFixed(6)}, ${b.lng.toFixed(6)}</code>${icon('external', { size: 11 })}</a>
      <a href="https://www.openstreetmap.org/?mlat=${b.lat.toFixed(6)}&mlon=${b.lng.toFixed(6)}#map=18/${b.lat.toFixed(6)}/${b.lng.toFixed(6)}"
        target="_blank" rel="noopener noreferrer" title="Mở vị trí trên OpenStreetMap">OSM ${icon('external', { size: 11 })}</a>`
    : '<span class="fbuild__coord--none">chưa có tọa độ</span>'}
    </div>
    <div class="fbuild__cta">
      <button class="btn btn--primary" type="button" data-focus="profile">Xem chi tiết</button>
      <button class="btn btn--outline" type="button" data-focus="compare"
        aria-pressed="${state.compare.includes(b.id)}">So sánh</button>
    </div>
    ${renderFocusFlags(b)}
    ${renderFocusDensity(b)}
    ${renderFocusBus(b)}
    ${renderFocusDrive(b)}
    ${renderFocusAmenities(b)}`;

  $('#focus-building').onclick = (e) => {
    const btn = e.target.closest('[data-focus]');
    if (!btn) return;
    if (btn.dataset.focus === 'profile') openProfile(b.id);
    else { toggleCompare(b.id); btn.setAttribute('aria-pressed', String(state.compare.includes(b.id))); }
  };
  wireFocusAmenityRoutes();
  syncMapPadding();
}

/* -------------------------------------------------------------------------
   CAMERA PHẢI BIẾT PHẦN NÀO CỦA BẢN ĐỒ ĐANG BỊ CHE.

   Đây là chỗ sửa gốc rễ của "bảng che gần hết tuyến đường đi". Bản trước
   không có phép đo này ở đâu cả: bản đồ căn theo tâm KHUNG VẼ, mà tâm khung
   vẽ nằm sau bảng. Chọn một tòa → tòa đó dừng ngay dưới bảng, và mọi tuyến
   đi bộ tỏa ra từ nó cũng vậy.

   Đo từ DOM chứ không viết cứng 372px: bảng đổi bề rộng theo màn hình, gập
   lại được, và trên màn hẹp nó nằm ở ĐÁY chứ không ở cạnh trái. Một phép đo
   đúng ở cả ba trạng thái tốt hơn ba con số viết tay.
   ------------------------------------------------------------------------- */
function syncMapPadding() {
  const col = $('.mapcol');
  if (!map?.map || !col) return;
  const cr = col.getBoundingClientRect();
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  const pad = { top: 14, right: 56, bottom: 14, left: 14 };   // chừa nút thu phóng góc phải

  const panel = $('#focus');
  if (panel && !panel.hidden) {
    const pr = panel.getBoundingClientRect();
    col.style.setProperty('--focus-h', Math.round(pr.height) + 'px');
    if (panel.classList.contains('is-folded')) {
      // Đã gập thì bảng chỉ còn một thanh ngắn ở góc trên. Vẫn giữ nguyên
      // padding TRÁI lúc này là phản bội đúng thao tác vừa rồi: người dùng
      // gập bảng để LẤY LẠI chỗ, không phải để đổi hình dáng cái hộp.
      pad.top = Math.max(pad.top, Math.round(pr.bottom - cr.top) + 12);
    } else if (mobile) {
      pad.bottom = Math.max(pad.bottom, Math.round(pr.height) + 12);
    } else {
      pad.left = Math.max(pad.left, Math.round(pr.right - cr.left) + 12);
    }
  } else {
    col.style.removeProperty('--focus-h');
  }

  const strip = $('#filmstrip');
  if (strip && !strip.hidden && !mobile) {
    pad.bottom = Math.max(pad.bottom, Math.round(strip.getBoundingClientRect().height) + 10);
  }
  map.setViewportPadding(pad);
}

/* Bảng đổi chiều cao mỗi khi bật/tắt một nhóm tiện ích hoặc mở "tùy chọn".
   Trên màn hẹp chiều cao ĐÓ chính là padding đáy của camera, nên không theo
   dõi thì bản đồ căn theo một kích thước đã cũ. */
function watchFocusSize() {
  const panel = $('#focus');
  if (!panel) return;
  if ('ResizeObserver' in window) {
    let t = null;
    new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(syncMapPadding, 60);
    }).observe(panel);
  }

  /* Cuộn sâu vào danh sách thì tên tòa nhà trôi khỏi màn hình, và bảng trở
     thành một danh sách địa điểm không rõ QUANH CÁI GÌ. Rê chuột lên một
     marker trên bản đồ cũng cuộn danh sách tới dòng tương ứng, nên chuyện
     này xảy ra cả khi người dùng không tự cuộn.

     Dòng tên vốn đã có sẵn cho trạng thái gập; ở đây chỉ cho nó hiện thêm
     khi đã cuộn qua phần đầu. Một thanh mỏng, không thêm bề mặt nào mới. */
  const sc = $('#focus-scroll');
  sc?.addEventListener('scroll', () => {
    panel.classList.toggle('is-scrolled', sc.scrollTop > 72);
  }, { passive: true });
}

/* =========================================================================
   Tiện ích mở từ OpenStreetMap trên bản đồ

   Hai tập dữ liệu KHÁC NHAU, không bao giờ trộn:
   - Google Places (trong payload) → chỉ danh sách trong hồ sơ, khoảng cách
     đường thẳng. Không lên bản đồ (GOOGLE_OPEN_MAP_ARCHITECTURE_R1 §3).
   - OpenStreetMap (lớp này) → lên bản đồ được, kèm đường đi bộ thật.
   ========================================================================= */

/* Ba mức thay vì một công tắc bật/tắt: "chỉ đường ray" là mức thật sự có
   người cần — hai nghìn chấm xe buýt là bối cảnh hữu ích ở mức khu phố nhưng
   thành nhiễu khi đang đọc một tuyến đi bộ cụ thể. */
function buildTransitControls() {
  const seg = $('[data-transit]')?.closest('.seg');
  if (!seg) return;
  const n = state.transitData?.layers?.bus_stops?.features?.length;
  const tag = $('#bus-n');
  if (tag && n != null) tag.textContent = String(n);
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-transit]');
    if (!btn) return;
    state.transit = btn.dataset.transit;
    $$('[data-transit]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    map?.setTransitMode(state.transit);
    announce(state.transit === 'off' ? 'Đã tắt lớp giao thông.'
      : state.transit === 'metro' ? 'Đang hiện đường sắt và metro; đã ẩn điểm dừng xe buýt.'
        : 'Đang hiện đầy đủ lớp giao thông: xe buýt, đường sắt, metro và sân bay.');
  });
}

function buildAreaControls() {
  const btn = $('#btn-areas');
  if (!btn) return;
  const n = new Set(state.data.buildings.map((b) => b.currentWard).filter(Boolean)).size;
  const tag = $('#ward-n');
  if (tag && n != null) tag.textContent = String(n);
  btn.setAttribute('aria-pressed', String(state.areas));
  btn.addEventListener('click', () => {
    state.areas = !state.areas;
    btn.setAttribute('aria-pressed', String(state.areas));
    map?.setAreasVisible(state.areas);
    announce(state.areas ? 'Đang hiện ranh giới phường.' : 'Đã ẩn ranh giới phường.');
  });
}

function buildAmenityControls() {
  $('#amenity-cats').innerHTML = AMENITY_CATEGORIES.map((c) => `
    <button class="amcat" type="button" data-cat="${esc(c.key)}"
      aria-pressed="${state.amenityCats.has(c.key) ? 'true' : 'false'}"
      style="--amcat-color:${esc(c.color)}"><i class="amcat__ic" aria-hidden="true">${
  AMENITY_ICONS[c.icon] || ''}</i>${esc(c.label)}</button>`).join('');

  $('#amenity-cats').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    const cat = btn.dataset.cat;
    const adding = !state.amenityCats.has(cat);
    if (adding) state.amenityCats.add(cat);
    else state.amenityCats.delete(cat);
    btn.setAttribute('aria-pressed', String(adding));
    // Bật thêm một nhóm → đưa cả tập mới vào tầm nhìn. Tắt bớt → giữ nguyên
    // khung: người dùng vừa BỎ thứ gì đó, kéo camera lúc này là trả lời một
    // câu không ai hỏi.
    paintAmenities({ fit: adding });
  });

  // Bao nhiêu tuyến được vẽ. Mặc định "gần nhất mỗi nhóm": tám tuyến đọc
  // được, bốn mươi tám tuyến thì thành mớ chỉ rối. "Tất cả" vẫn còn cho ai
  // muốn thấy toàn mạng đường — nhưng đó là lựa chọn, không phải mặc định.
  $('[data-routes]')?.closest('.seg')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-routes]');
    if (!btn) return;
    state.routeMode = btn.dataset.routes;
    $$('[data-routes]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    map?.setRouteMode(state.routeMode);
  });

  /* Map khởi tạo với routeMode riêng của nó ('off'). Không đẩy mặc định của
     state xuống thì nút hiện "Gần nhất mỗi nhóm" đang bật trong khi bản đồ
     vẫn chạy chế độ 'off' — giao diện nói một đằng, bản đồ vẽ một nẻo. */
  map?.setRouteMode(state.routeMode);

  buildBandControls();

  /* Gập cả bảng lại khi muốn nhìn bản đồ trống.

     Gập xong PHẢI đo lại padding: bảng thu về một dòng thì phần bản đồ còn
     thấy được rộng ra gần gấp đôi, và camera phải biết điều đó ngay — nếu
     không, gập bảng đi rồi mà bản đồ vẫn căn như thể bảng còn nguyên. */
  $('#amenity-fold')?.addEventListener('click', () => {
    const btn = $('#amenity-fold');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    $('#focus').classList.toggle('is-folded', !open);
    btn.querySelector('.sr-only').textContent = open
      ? 'Thu gọn bảng để nhìn bản đồ trống' : 'Mở lại bảng tòa nhà';
    syncMapPadding();
  });

  // Rê chuột trên BẢN ĐỒ làm sáng đúng dòng trong danh sách. Chiều ngược lại
  // do renderAmenityList lo. Thiếu một trong hai chiều thì hai bề mặt lại
  // trơ với nhau như bản trước.
  map.onAmenityHover = (rid) => syncAmenityRow(rid);
}

/* -------------------------------------------------------------------------
   KHUNG GIỜ.

   Dữ liệu chính sắp có thời gian tới tiện ích theo khung giờ thường và cao
   điểm. Chỗ để nó là NGAY CẠNH con số giờ thường, trên cùng một dòng —
   không phải trong một menu riêng phải đi tìm. Một con số "4 phút" chỉ có
   nghĩa khi biết giờ thường là 2 phút.

   Trước khi dữ liệu về: nút "Cao điểm" vẫn hiện nhưng KHOÁ, mang đúng ngôn
   ngữ hình ảnh của trạng thái chưa thu thập (viền đứt + gạch chéo). Hiện
   một nút bấm được rồi trả về cùng con số là nói dối; giấu hẳn thì người
   dùng không biết chiều dữ liệu này sắp có.
   ------------------------------------------------------------------------- */
function buildBandControls() {
  const wrap = $('[data-band]')?.closest('.seg');
  if (!wrap) return;
  const peak = $('[data-band="peak"]');
  const have = !!state.amenityData?.bands?.peak;

  if (!have) {
    peak.disabled = true;
    peak.classList.add('is-none');
    peak.title = 'Chưa có số liệu giờ cao điểm.';
  }
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-band]');
    if (!btn || btn.disabled) return;
    state.band = btn.dataset.band;
    $$('[data-band]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    // Nhãn cột trong danh sách phải nói rõ số phút đang thuộc khung giờ nào.
    // Một con số không có khung giờ là con số không đọc được.
    const tag = $('#band-tag');
    if (tag) tag.textContent = state.band === 'peak' ? 'giờ cao điểm' : 'giờ thường';
    paintAmenities();
  });

  const note = $('#band-note');
  if (note) {
    note.innerHTML = have
      ? ''
      : 'Số phút là một giá trị chung, chưa tách theo giờ cao điểm.';
    note.hidden = have;
  }
}

/* Ba cách hiển thị vùng quanh tòa, đặt cạnh nhau có chủ đích:
   - "5/10/15 phút" = isochrone, bám mạng đường thật
   - "500 m / 1 km" = vòng tròn đường thẳng, đúng định nghĩa mà payload dùng
   - "Tắt"
   Để cả hai lựa chọn cạnh nhau là cách nhanh nhất cho thấy vòng tròn nói dối
   tới đâu — nó băng qua sông Sài Gòn, isochrone thì không. */
function buildReachControls() {
  const wrap = $('[data-reach]')?.closest('.seg');
  if (!wrap) return;
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reach]');
    if (!btn) return;
    state.reach = btn.dataset.reach;
    $$('[data-reach]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    paintReach();
  });
}

function paintReach() {
  if (!map) return;
  const mode = state.reach || 'ring';
  map.setRingsVisible(mode === 'ring');
  const res = map.showIsochrones(mode === 'iso' ? state.selectedId : null, mode === 'iso');
  const note = $('#reach-note');
  if (!note) return;
  if (mode === 'iso') {
    const b = state.data.buildings.find((x) => x.id === state.selectedId);
    note.innerHTML = 'Vùng đi bộ được trong 5, 10 và 15 phút theo đường thật, tốc độ 75 m/phút.'
      + (res?.bands ? '' : b ? ' <em>Chưa có cho tòa này.</em>' : '');
  } else if (mode === 'ring') {
    note.textContent = 'Vòng 500 m và 1 km đo theo đường thẳng. Chọn "5 / 10 / 15 phút" để xem vùng đi bộ.';
  } else {
    note.textContent = 'Đã tắt lớp vùng quanh tòa nhà.';
  }
}

/* -------------------------------------------------------------------------
   DANH SÁCH XẾP HẠNG — thứ thay cho 48 nhãn chồng nhau trên bản đồ.

   Mỗi dòng trả lời trọn vẹn một câu hỏi: đi bộ mấy phút, tới đâu, thuộc
   nhóm nào, bao xa, và vòng bao nhiêu so với đường thẳng. Xếp theo phút,
   nên dòng đầu luôn là chỗ gần nhất — không phải đi dò trên bản đồ.

   Dòng nào là GẦN NHẤT CỦA NHÓM thì mang dấu — đó chính là các địa điểm
   được gắn nhãn tên trên bản đồ, nên hai bề mặt khớp nhau, không phải hai
   tập hợp rời rạc.
   ------------------------------------------------------------------------- */
function renderAmenityList(list) {
  const ol = $('#amenity-list');
  const more = $('#amenity-more');
  if (!ol) return;
  if (!list?.length) {
    ol.innerHTML = '';
    if (more) more.hidden = true;
    return;
  }

  const CAP = 40;
  const shown = list.slice(0, CAP);
  const cnt = $('#amenity-count');
  if (cnt) cnt.textContent = list.length > CAP ? shown.length + ' / ' + list.length : String(list.length);

  // Thang của thanh quãng đường lấy theo chính tập ĐANG HIỆN, không phải một
  // hằng số. Bật một nhóm gần thì cả tám dòng đều ngắn; thang cố định sẽ vẽ
  // ra tám vạch tí hon giống hệt nhau, tức là không so sánh được gì.
  const maxM = Math.max(...shown.map((p) => Math.max(p.walkM, p.straightM || 0)), 1);
  ol.innerHTML = shown.map((p) => {
    const detour = String(p.detourRatio ?? '—').replace('.', ',');
    const pw = (p.walkM / maxM) * 100;
    const ps = ((p.straightM || 0) / maxM) * 100;
    return `<li class="amrow${p.lead ? ' is-lead' : ''}" style="--amk-color:${esc(p.color)}">
      <button type="button" data-rid="${p.rid}"
        aria-label="${esc(p.name)}, ${esc(p.catLabel)}. Đi bộ ${p.walkMin} phút, ${p.walkM} mét, đường chim bay ${p.straightM} mét, hệ số vòng ${detour} lần.${p.lead ? ' Gần nhất trong nhóm.' : ''}">
        <span class="amrow__min"><i class="amk__ic" aria-hidden="true">${AMENITY_ICONS[p.icon] || ''}</i><b>${p.walkMin}</b></span>
        <span class="amrow__who">
          <b>${esc(p.name)}</b>
          <i>${esc(p.catLabel)}${p.lead ? ' · <em>gần nhất nhóm</em>' : ''}</i>
        </span>
        <span class="amrow__num"><b>${p.walkM} m</b></span>
        <span class="amrow__bar">
          <span class="amrow__track" aria-hidden="true">
            <span class="amrow__fill" style="width:${pw.toFixed(1)}%"></span>
            <span class="amrow__straight" style="width:${ps.toFixed(1)}%"></span>
          </span>
          <span class="amrow__detour${p.detourRatio >= 1.8 ? ' is-high' : ''}">vòng ${detour}×</span>
        </span>
      </button>
    </li>`;
  }).join('');

  if (more) {
    more.hidden = list.length <= CAP;
    more.textContent = `Còn ${list.length - CAP} địa điểm khác trong bán kính 900 m. Bỏ bớt nhóm để xem.`;
  }

  // Liên kết danh sách → bản đồ. Dùng uỷ quyền sự kiện: gắn 40 bộ nghe cho
  // mỗi lần vẽ lại sẽ rò bộ nhớ khi đổi tòa nhà liên tục.
  //
  // revealAmenity: rê một dòng mà bản đồ không nhúc nhích thì dòng đó không
  // dẫn tới đâu cả. Nó CHỈ dời khung khi địa điểm đang thật sự nằm ngoài —
  // dời mỗi lần rê sẽ thành bản đồ nhảy liên tục dưới con trỏ.
  ol.onmouseover = (e) => {
    const b = e.target.closest('[data-rid]');
    if (b) map?.highlightRoute(Number(b.dataset.rid));
  };
  ol.onmouseleave = () => map?.highlightRoute(null);
  ol.onfocusin = (e) => {
    const b = e.target.closest('[data-rid]');
    if (!b) return;
    map?.highlightRoute(Number(b.dataset.rid));
    map?.revealAmenity(Number(b.dataset.rid));
  };
  ol.onclick = (e) => {
    const b = e.target.closest('[data-rid]');
    if (!b) return;
    // Đưa vào tầm nhìn TRƯỚC khi mở thẻ chi tiết. Thẻ neo vào toạ độ địa
    // điểm, nên nếu địa điểm đang nằm ngoài khung — hoặc nằm dưới chính
    // bảng này — thì bấm vào dòng sẽ mở một tấm thẻ không ai thấy.
    const rid = Number(b.dataset.rid);
    map?.revealAmenity(rid);
    map?.openAmenityPopup(rid);
  };
}

/** Làm sáng dòng tương ứng khi con trỏ đang ở trên bản đồ. */
function syncAmenityRow(rid) {
  const ol = $('#amenity-list');
  if (!ol) return;
  let hit = null;
  for (const li of ol.children) {
    const on = rid != null && li.firstElementChild?.dataset.rid === String(rid);
    li.classList.toggle('is-hot', on);
    if (on) hit = li;
  }
  // Chỉ cuộn khi con trỏ ĐANG ở trên bản đồ. Cuộn khi con trỏ ở trong chính
  // danh sách sẽ giật dòng ra khỏi dưới con trỏ.
  if (hit && !ol.matches(':hover')) {
    hit.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
}

function paintAmenities({ fit = false } = {}) {
  const bar = $('#amenitybar');
  if (!state.amenityData) { bar.hidden = true; return; }

  const entry = state.selectedId && state.amenityData.buildings?.[state.selectedId];
  bar.hidden = !entry;
  if (!entry) { map?.clearAmenities(); renderAmenityList([]); return; }

  const b = state.data.buildings.find((x) => x.id === state.selectedId);
  const total = entry.categories.reduce((n, c) => n + c.places.length, 0);

  // Tiêu đề đếm ĐÚNG thứ đang hiện, không phải tổng số có sẵn. Khi chưa bật
  // nhóm nào thì nói rõ là chưa bật, chứ không để con số 480 gây hiểu nhầm
  // rằng ngần ấy đang nằm trên bản đồ.
  const on = entry.categories.filter((c) => state.amenityCats.has(c.key));
  const shown = on.reduce((n, c) => n + c.places.length, 0);
  const mins = on.flatMap((c) => c.places.map((p) => p.walkMin));
  $('#amenity-title').innerHTML = shown
    ? `${shown} địa điểm, đi bộ ${Math.min(...mins)}–${Math.max(...mins)} phút`
    : `${total} địa điểm quanh ${esc(b.name)}`;

  // Nhóm không có kết quả KHÔNG phải nhóm bị lỗi và cũng không phải số 0.
  // Nó là một QUAN SÁT: đã tìm theo phương pháp đã công bố, trong bán kính
  // 900 m, và không có gì. Nên nó mang ngôn ngữ hình ảnh riêng (viền đứt +
  // gạch chéo) chứ không chỉ bị làm xám đi.
  const have = new Set(entry.categories.filter((c) => c.places.length).map((c) => c.key));
  /* SỐ PHÚT TỚI CÁI GẦN NHẤT, đặt ngay trên nút nhóm.

     Đã thử đặt SỐ LƯỢNG địa điểm ở đây và bỏ: bộ dữ liệu giữ tối đa sáu
     địa điểm gần nhất mỗi nhóm, nên gần như nhóm nào cũng hiện "6". Một con
     số giống hệt nhau ở tám cái nút không phân biệt được gì, và tệ hơn, nó
     đọc ra như "quanh đây có đúng sáu quán ăn" trong khi đó chỉ là mức cắt
     của dữ liệu.

     Số phút thì khác nhau thật và trả lời đúng câu người thuê hỏi: nhóm nào
     thực sự gần. Đọc được TRƯỚC KHI bật — không phải bật từng nhóm lên xem. */
  const leadMin = new Map(entry.categories
    .filter((c) => c.places.length)
    .map((c) => [c.key, Math.min(...c.places.map((p) => p.walkMin))]));
  $$('#amenity-cats [data-cat]').forEach((btn) => {
    const ok = have.has(btn.dataset.cat);
    btn.disabled = !ok;
    btn.classList.toggle('is-none', !ok);
    btn.title = ok ? `Gần nhất: ${leadMin.get(btn.dataset.cat)} phút đi bộ`
      : 'Không có địa điểm nào trong bán kính 900 m';
    let n = btn.querySelector('.amcat__n');
    if (ok) {
      if (!n) {
        n = document.createElement('b');
        n.className = 'amcat__n';
        btn.appendChild(n);
      }
      n.textContent = leadMin.get(btn.dataset.cat) + ' ph';
    } else if (n) n.remove();
    const tag = btn.querySelector('.amcat__none');
    if (!ok && !tag) {
      const s = document.createElement('span');
      s.className = 'amcat__none';
      s.textContent = 'không có kết quả';
      btn.appendChild(s);
    } else if (ok && tag) tag.remove();
  });

  const res = map?.showAmenities(state.selectedId, [...state.amenityCats]);
  renderAmenityList(res?.list || []);
  const empty = $('#amenity-empty');
  if (empty) empty.hidden = !!res?.count;
  paintReach();

  /* ĐƯA THỨ VỪA BẬT LÊN VÀO TẦM NHÌN.

     Bản trước bật một nhóm tiện ích mà KHÔNG hề đụng tới camera. Đo được ở
     ảnh chụp lỗi: sáu địa điểm được bật, hai cái nằm trong khung, bốn cái
     ngoài mép hoặc dưới bảng. Người dùng phải tự đi tìm thứ mình vừa bật —
     và kết luận hợp lý nhất khi không thấy gì là "trang này hỏng".

     Chỉ dời khi cần: nếu tất cả đã nằm gọn trong phần còn thấy được thì
     giữ nguyên khung, để không giật camera ra khỏi chỗ người dùng vừa kéo tới. */
  if (fit) map?.fitAmenities(state.selectedId);

  if (res?.count) {
    announce(`Đang hiện ${res.count} địa điểm quanh tòa nhà, xếp theo phút đi bộ.`);
  }
}
function toggleCompare(id) {
  const i = state.compare.indexOf(id);
  if (i >= 0) state.compare.splice(i, 1);
  else if (state.compare.length < 4) state.compare.push(id);
  else { announce('Khay so sánh đã đủ 4 tòa. Bỏ bớt một tòa trước khi thêm.'); return; }
  renderTray();
  map?.setCompare(state.compare);
  renderList(state.visible);
}

function renderTray() {
  $('#tray').hidden = state.compare.length === 0;
  $('#btn-compare').disabled = state.compare.length < 2;
  // Bỏ qua id không còn trong bộ dữ liệu thay vì ném lỗi. Khay so sánh giữ
  // id qua nhiều lần lọc và qua cả lần nạp dữ liệu mới; một id lạc không
  // được phép làm hỏng cả khay.
  $('#tray-items').innerHTML = state.compare.map((id) => {
    const b = state.data.buildings.find((x) => x.id === id);
    if (!b) return '';
    return `<span class="tray__item">${esc(b.name)}
      <button class="tray__x" type="button" data-act="untray" data-id="${esc(id)}"
        aria-label="Bỏ ${esc(b.name)} khỏi khay so sánh">${icon('close', { size: 11 })}</button></span>`;
  }).join('');
  announce(`Khay so sánh: ${state.compare.length} tòa.`);
}

/* ========================================================================= */
/*  Bảng lệnh ⌘K — tìm kiếm và lệnh nhanh, mẫu Command của shadcn            */
/* ========================================================================= */

const COMMANDS = [
  { id: 'cmd:filters', label: 'Mở bộ lọc', hint: 'Lệnh', run: () => toggleFilters(true) },
  { id: 'cmd:clear', label: 'Xóa toàn bộ bộ lọc', hint: 'Lệnh', run: () => resetFilters() },
  { id: 'cmd:compare', label: 'Mở bảng so sánh', hint: 'Lệnh', run: () => openCompare() },
  { id: 'cmd:method', label: 'Mở phương pháp và nguồn', hint: 'Lệnh', run: () => openMethod() },
  { id: 'cmd:theme', label: 'Đổi chế độ sáng / tối', hint: 'Lệnh', run: () => toggleTheme() },
  { id: 'cmd:motion', label: 'Bật hoặc tắt giảm chuyển động', hint: 'Lệnh', run: () => toggleMotion() },
  { id: 'cmd:density', label: 'Đổi giữa thẻ và bảng', hint: 'Lệnh', run: () => toggleDensity() },
];

function openCmdk() {
  state.cmdk.open = true;
  state.lastFocus = document.activeElement;
  const el = $('#cmdk');
  el.hidden = false; $('#scrim').hidden = false;
  requestAnimationFrame(() => { el.classList.add('is-open'); $('#scrim').classList.add('is-open'); });
  $('#cmdk-input').value = '';
  runCmdk('');
  $('#cmdk-input').focus();
}

function closeCmdk() {
  state.cmdk.open = false;
  $('#cmdk').classList.remove('is-open');
  setTimeout(() => { $('#cmdk').hidden = true; }, reducedMotion() ? 0 : 130);
  if (!isLayerOpen()) { $('#scrim').classList.remove('is-open'); setTimeout(() => { $('#scrim').hidden = true; }, reducedMotion() ? 0 : 300); }
  state.lastFocus?.focus?.();
}

function runCmdk(q) {
  const query = q.trim().toLowerCase();
  const buildings = state.data.buildings
    .filter((b) => !query || (b.name + ' ' + b.address + ' ' + b.districtLabel + ' ' + b.submarketLabel + ' ' + b.id).toLowerCase().includes(query))
    .map((b) => ({
      id: b.id, label: b.name, hint: 'Tòa nhà',
      meta: `${b.districtLabel} · hạng ${b.gradeLabel} · ${isPresent(b.baseRent) ? 'giá ' + money(b.baseRent.value) : 'chưa có giá'}`,
      right: isPresent(b.distanceMetro) ? distance(b.distanceMetro.value) : '',
      run: () => { selectBuilding(b.id); openProfile(b.id); },
    }));
  const cmds = COMMANDS.filter((c) => !query || c.label.toLowerCase().includes(query));

  state.cmdk.results = [...buildings, ...cmds];
  state.cmdk.index = 0;

  const list = $('#cmdk-list');
  if (!state.cmdk.results.length) {
    list.innerHTML = `<p class="cmdk__empty">Không có kết quả cho “${esc(q)}”.</p>`;
    return;
  }
  let html = '';
  if (buildings.length) {
    html += `<div class="cmdk__group" role="presentation">Tòa nhà (${buildings.length})</div>`;
    html += buildings.map((r, i) => cmdkRow(r, i)).join('');
  }
  if (cmds.length) {
    html += `<div class="cmdk__group" role="presentation">Lệnh</div>`;
    html += cmds.map((r, i) => cmdkRow(r, buildings.length + i)).join('');
  }
  list.innerHTML = html;
  paintCmdkActive();
}

function cmdkRow(r, i) {
  return `<button class="cmdk__opt" type="button" role="option" data-i="${i}" aria-selected="false" id="cmdk-opt-${i}">
    ${icon(r.hint === 'Lệnh' ? 'command' : 'building', { size: 14 })}
    <span class="cmdk__main">
      <span class="cmdk__nm">${esc(r.label)}</span>
      ${r.meta ? `<span class="cmdk__meta">${esc(r.meta)}</span>` : ''}
    </span>
    ${r.right ? `<span class="cmdk__right">${esc(r.right)}</span>` : ''}
  </button>`;
}

function paintCmdkActive() {
  const opts = $$('.cmdk__opt');
  opts.forEach((o, i) => o.setAttribute('aria-selected', String(i === state.cmdk.index)));
  const active = opts[state.cmdk.index];
  active?.scrollIntoView({ block: 'nearest' });
  $('#cmdk-input').setAttribute('aria-activedescendant', active ? active.id : '');
}

function moveCmdk(d) {
  const n = state.cmdk.results.length;
  if (!n) return;
  state.cmdk.index = (state.cmdk.index + d + n) % n;
  paintCmdkActive();
}

function chooseCmdk() {
  const r = state.cmdk.results[state.cmdk.index];
  if (!r) return;
  closeCmdk();
  setTimeout(() => r.run(), reducedMotion() ? 0 : 60);
}

/* ========================================================================= */
/*  Lớp phủ                                                                   */
/* ========================================================================= */

const isLayerOpen = () => !$('#sheet').hidden || !$('#overlay').hidden;

function openProfile(id) {
  const b = state.data.buildings.find((x) => x.id === id);
  if (!b) return;
  state.lastFocus = document.activeElement;
  $('#sheet-title').textContent = b.name;
  $('#sheet-body').innerHTML = renderProfile(b, state.data, state.amenityData, state.giaNguon, state.canXacNhan);
  $$('#sheet-body [data-act="compare"]').forEach((btn) =>
    btn.setAttribute('aria-pressed', String(state.compare.includes(btn.dataset.id))));

  // Nút nạp nội dung Google cho phần tiện ích. Nạp THEO YÊU CẦU, một lần cho
  // mỗi lần mở hồ sơ — mỗi thẻ là một lượt tính tiền vào tài khoản người dùng.
  $('#pf-gg-load')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    const cfg = await docCauHinhGoogle();
    const r = await enrichProfileWithGoogle($('#sheet-body'),
      { key: cfg.GOOGLE_MAPS_API_KEY, shareMode: !!cfg.SHARE_MODE });
    if (r?.n) announce(`Đã nạp ${r.n} thẻ chi tiết từ Google, gồm ảnh và đánh giá.`);
  }, { once: true });

  openLayer($('#sheet'));
  $('#sheet-body').scrollTop = 0;
  $('#sheet-body').focus();
}

function openCompare() {
  const items = state.compare.map((id) => state.data.buildings.find((x) => x.id === id)).filter(Boolean);
  if (items.length < 2) { announce('Cần ít nhất hai tòa trong khay so sánh.'); return; }
  state.lastFocus = document.activeElement;
  $('#overlay-title').textContent = `So sánh ${items.length} tòa nhà`;
  $('#overlay-body').innerHTML = renderCompare(items, state.data,
    { density: state.densityData, bus: state.busNetwork, driving: state.drivingData });
  openLayer($('#overlay'));
  $('#overlay-body').scrollTop = 0;
  $('#overlay-body').focus();
}

function openMethod() {
  state.lastFocus = document.activeElement;
  $('#sheet-title').textContent = 'Phương pháp và nguồn dữ liệu';
  $('#sheet-body').innerHTML = renderMethod(state.data, MAP_META);
  openLayer($('#sheet'));
  $('#sheet-body').scrollTop = 0;
  $('#sheet-body').focus();
}

function openLayer(el) {
  el.hidden = false; $('#scrim').hidden = false;
  requestAnimationFrame(() => { el.classList.add('is-open'); $('#scrim').classList.add('is-open'); });
  trapFocus(el);
}

function closeLayers() {
  for (const el of [$('#sheet'), $('#overlay')]) {
    if (el.hidden) continue;
    el.classList.remove('is-open');
    const done = () => { el.hidden = true; };
    reducedMotion() ? done() : setTimeout(done, 300);
  }
  $('#scrim').classList.remove('is-open');
  setTimeout(() => { $('#scrim').hidden = true; }, reducedMotion() ? 0 : 300);
  releaseFocus();
  state.lastFocus?.focus?.();
}

let trapEl = null;
function trapFocus(el) { trapEl = el; document.addEventListener('keydown', onTrapKey, true); }
function releaseFocus() { trapEl = null; document.removeEventListener('keydown', onTrapKey, true); }
function onTrapKey(e) {
  if (e.key !== 'Tab' || !trapEl) return;
  const f = $$('a[href], button:not([disabled]), input, select, textarea, summary, [tabindex]:not([tabindex="-1"])', trapEl)
    .filter((n) => n.offsetParent !== null || n === document.activeElement);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ========================================================================= */
/*  Công tắc                                                                  */
/* ========================================================================= */

function toggleTheme() {
  const next = theme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('pi-theme', next); } catch (e) { /* bị chặn */ }
  $('#ic-theme').innerHTML = icon(next === 'dark' ? 'sun' : 'moon', { size: 14 });
  $('#btn-theme').setAttribute('aria-label', next === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối');
  map?.setTheme();
  announce(next === 'dark' ? 'Đã chuyển sang chế độ tối.' : 'Đã chuyển sang chế độ sáng.');
}

function toggleMotion() {
  state.motion = state.motion === 'reduced' ? 'system' : 'reduced';
  const on = state.motion === 'reduced';
  document.documentElement.dataset.motion = on ? 'reduced' : 'system';
  $('#btn-motion').setAttribute('aria-pressed', String(on));
  announce(on ? 'Đã giảm chuyển động.' : 'Chuyển động theo cài đặt hệ thống.');
}

function toggleDensity() {
  state.density = state.density === 'cards' ? 'table' : 'cards';
  $('#btn-density').setAttribute('aria-pressed', String(state.density === 'table'));
  $('#ic-density').innerHTML = icon(state.density === 'table' ? 'grid' : 'list', { size: 14 });
  renderList(state.visible);
  announce(state.density === 'table' ? 'Đang xem dạng bảng dày.' : 'Đang xem dạng thẻ.');
}

function toggleFilters(force) {
  const open = force !== undefined ? force : !$('#filters').classList.contains('is-open');
  $('#filters').classList.toggle('is-open', open);
  $('#btn-filters').setAttribute('aria-expanded', String(open));
  $('#btn-filters').setAttribute('aria-pressed', String(open));
}

function setView(v) {
  document.body.dataset.view = v;
  $('#view-map').setAttribute('aria-pressed', String(v === 'map'));
  $('#view-list').setAttribute('aria-pressed', String(v === 'list'));
  $('#view-overview').setAttribute('aria-pressed', String(v === 'overview'));
  $('#view-market').setAttribute('aria-pressed', String(v === 'market'));
  $('#view-story').setAttribute('aria-pressed', String(v === 'story'));
  $('#view-notes').setAttribute('aria-pressed', String(v === 'notes'));
  if (v === 'map') setTimeout(() => { map?.resize(); syncMapPadding(); }, 40);
  if (v === 'overview') paintOverview();
  if (v === 'market') paintMarket();
  if (v === 'story') paintStory();
  if (v === 'notes') paintNotes();
}

/* Trang tổng quan — bề mặt 'báo cáo'. Vẽ lại khi vào, khi đổi đại lượng tô
   màu, và khi đổi tòa đang chọn. Không vẽ ngầm ở nền: 12 thẻ ô, 12 thanh,
   12 dòng quả tạ và một bảng là đủ nặng để không nên dựng khi chưa ai xem. */
/* Màn hình Google — nạp THEO YÊU CẦU. Script của Google chỉ tải khi người
   dùng bấm nút, vì mỗi lượt là một lượt tính tiền, và vì ba bề mặt còn lại
   phải giữ được tính chất chạy ngoại tuyến. */
/* Mục kể chuyện: dựng KHI VÀO, không dựng ngầm ở nền. Nó tạo một bản đồ
   MapLibre thứ hai (ngữ cảnh WebGL riêng, nền riêng, lớp riêng) — dựng sẵn
   khi chưa ai xem là trả giá GPU cho một màn hình có thể không bao giờ mở.
   Bản đồ chính không dùng lại được ở đây: nó nằm trong bố cục khác và mang
   một bộ lớp khác hẳn. */
let storyReady = false;
async function paintStory() {
  if (document.body.dataset.view !== 'story') return;
  const host = $('#storyview');
  if (storyReady) { resizeStory(); return; }
  storyReady = true;
  host.innerHTML = storyShell();
  const ml = await import('../vendor/maplibre/maplibre-gl.mjs');
  await mountStory(host, {
    buildings: state.data.buildings,
    metroStations: state.data.metroStations || [],
    ml,
  });
}

async function paintGoogle() {
  if (document.body.dataset.view !== 'google') return;
  const host = $('#googleview');
  if (host.dataset.ready === '1') return;   // đã nạp rồi thì không gọi lại
  host.innerHTML = googleShell();
  $('#gg-start')?.addEventListener('click', async () => {
    const cfg = await docCauHinhGoogle();
    const b = state.data.buildings.find((x) => x.id === state.selectedId) || state.data.buildings[0];
    await startGoogle({
      key: cfg.GOOGLE_MAPS_API_KEY,
      mapId: cfg.GOOGLE_MAP_ID || 'DEMO_MAP_ID',
      building: b,
      shareMode: !!cfg.SHARE_MODE,
    });
    host.dataset.ready = '1';
  }, { once: true });
}

/* Cấu hình Google: config.local.js (bị git theo dõi, khoá để trống) rồi khoá riêng config.khoa.js (git bỏ qua, 30/09).
   Chế độ chia sẻ: máy chủ trả bản rỗng cho config.local.js và chặn config.khoa.js, nên khách không bao giờ nhận khoá. */
async function docCauHinhGoogle() {
  let cfg = {};
  try { cfg = { ...(await import('../config.local.js')) }; } catch { cfg = {}; }
  if (!cfg.GOOGLE_MAPS_API_KEY && !cfg.SHARE_MODE) {
    try { cfg.GOOGLE_MAPS_API_KEY = (await import('../config.khoa.js')).GOOGLE_MAPS_API_KEY; } catch { /* không có khoá riêng */ }
  }
  return cfg;
}

/* Lưu ý (01/10): ca chờ thầy xác nhận, tòa mang tên khác trên trang rao, tòa chưa có vị trí. Dữ liệu đã nạp lúc mở trang. */
function paintNotes() {
  if (document.body.dataset.view !== 'notes') return;
  $('#notesview').innerHTML = renderNotes(state.canXacNhan, state.data.buildings);
}

/* Biến động giá chào: nạp dữ liệu KHI VÀO lần đầu (tệp nhỏ, không cần lúc mở trang). */
async function paintMarket() {
  if (document.body.dataset.view !== 'market') return;
  const host = $('#marketview');
  if (host.dataset.ready === '1') return;
  try {
    const d = await fetch('./data/bien_dong_gia_chao.json').then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    host.innerHTML = renderMarket(d);
    host.dataset.ready = '1';
  } catch (err) {
    host.innerHTML = '<div class="ov"><p class="ov__lede">Không nạp được dữ liệu biến động giá chào (' + err.message + ').</p></div>';
  }
}

function paintOverview() {
  if (document.body.dataset.view !== 'overview') return;
  // `renderOverview` nhận MỘT MẢNG tòa nhà. Trước đây chỗ này truyền
  // `state.data` (một đối tượng) kèm một túi tuỳ chọn mà hàm không hề nhận —
  // nên nó ném `buildings.filter is not a function` ngay dòng đầu và trang
  // Tổng quan CHƯA TỪNG vẽ được lần nào. Lỗi không lộ ra vì trang trống
  // trông giống như trang đang tải.
  $('#overview').innerHTML = renderOverview(state.data.buildings, state.canXacNhan, state.ovLoc);
}

function resetFilters() {
  $$('.togglechip, .mkt__pick, .wardrow').forEach((c) => c.setAttribute('aria-pressed', 'false'));
  $('#f-rent').value = $('#f-rent').max;
  $('#f-metro').value = $('#f-metro').max;
  $('#f-twosource').checked = false;
  $('#f-ward-search').value = '';
  $$('#f-current-ward .wardrow').forEach((row) => { row.hidden = false; });
  state.filters.query = '';
  apply({ fit: true });
}

/* ========================================================================= */
/*  Sự kiện                                                                   */
/* ========================================================================= */

function buildSortControl() {
  $('#sort').innerHTML = Object.entries(SORTS)
    .map(([k, v]) => `<option value="${k}" ${k === state.sort ? 'selected' : ''}>${esc(v.label)}</option>`).join('');
}

function wireEvents() {
  $('#f-rent').addEventListener('input', () => apply());
  $('#f-metro').addEventListener('input', () => apply());
  $('#f-twosource').addEventListener('change', () => apply());
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; apply(); });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());

  // Bật/tắt một lựa chọn. Ba vùng, ba loại nút, cùng một hành vi: cụm và
  // quận trong bộ chọn khu vực, dòng phường, và chip hạng.
  for (const box of ['#f-grade', '#f-district', '#f-market', '#f-current-ward']) {
    $(box)?.addEventListener('click', (e) => {
      const chip = e.target.closest('.togglechip, .mkt__pick, .wardrow');
      if (!chip) return;
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      apply();
      // Chọn khu vực thì đưa khung nhìn tới đó. Chọn HẠNG thì không —
      // hạng không phải một chỗ trên bản đồ.
      if (box !== '#f-grade') flyToSelection();
    });
  }

  $('#btn-filters').addEventListener('click', () => toggleFilters());
  $('#btn-clear').addEventListener('click', resetFilters);
  $('#btn-density').addEventListener('click', toggleDensity);
  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#btn-motion').addEventListener('click', toggleMotion);
  $('#btn-method').addEventListener('click', openMethod);
  $('#btn-help').addEventListener('click', openGuide);
  $('#btn-search').addEventListener('click', openCmdk);
  // Bản sao chỉ hiện ở màn hẹp: ô tìm kiếm thật nằm trong dải danh sách, mà
  // dải đó bị ẩn hẳn ở chế độ xem bản đồ trên điện thoại — đo được 0×0.
  $('#btn-search-m')?.addEventListener('click', openCmdk);
  $('#view-map').addEventListener('click', () => setView('map'));
  $('#view-list').addEventListener('click', () => setView('list'));
  $('#view-overview').addEventListener('click', () => setView('overview'));
  $('#view-market').addEventListener('click', () => setView('market'));
  $('#view-story').addEventListener('click', () => setView('story'));
  $('#view-notes').addEventListener('click', () => setView('notes'));

  // Lưới ô và bảng của trang tổng quan: bấm một tòa thì chọn tòa đó ở mọi
  // bề mặt, đúng như bấm marker trên bản đồ hay mục trong danh sách.
  $('#overview').addEventListener('click', (e) => {
    const m = e.target.closest('[data-metric]');
    if (m) { state.ovMetric = m.dataset.metric; paintOverview(); return; }
    // 01/10: bấm ô quận/hạng thì bảng danh sách lọc theo ô đó; bấm lại ô đang chọn hoặc nút "Xem lại" thì bỏ lọc.
    const o = e.target.closest('[data-ovloc]');
    if (o) {
      const moi = { kieu: o.dataset.ovloc, giaTri: o.dataset.ovval };
      const dang = state.ovLoc && state.ovLoc.kieu === moi.kieu && state.ovLoc.giaTri === moi.giaTri;
      state.ovLoc = dang ? null : moi;
      paintOverview();
      if (state.ovLoc) $('#ov-danh-sach')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-ovclear]')) { state.ovLoc = null; paintOverview(); return; }
    const t = e.target.closest('[data-ovid]');
    if (t) selectBuilding(t.dataset.ovid, { fly: false });
  });

  $('#listscroll').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      if (act.dataset.act === 'compare') toggleCompare(act.dataset.id);
      if (act.dataset.act === 'clear') resetFilters();
      /* CHỌN thôi, KHÔNG mở hồ sơ đầy đủ. Người dùng nói rõ: bấm vào một
         tòa chỉ nên hiện bảng tiêu điểm bên cạnh bản đồ; lớp hồ sơ dày
         chỉ mở khi bấm "Xem hồ sơ". Mở sẵn lớp phủ toàn màn hình mỗi lần
         bấm là cướp mất chính bản đồ mà người ta đang xem. */
      if (act.dataset.act === 'open') selectBuilding(act.dataset.id);
      return;
    }
    /* Bấm BẤT KỲ ĐÂU trên thẻ đều chọn tòa đó. Trước đây chỉ nút bên trong
       mới ăn, nên bấm vào tên hay ảnh thì không có gì xảy ra — và người
       dùng kết luận là bấm vào tòa nhà không hoạt động. Họ đúng. */
    const card = e.target.closest('.item[data-id]');
    if (card) { selectBuilding(card.dataset.id); return; }
    const row = e.target.closest('.dtable tbody tr');
    if (row) selectBuilding(row.dataset.id);
  });

  $('#listscroll').addEventListener('keydown', (e) => {
    const el = e.target.closest('.item__open, .dtable tbody tr');
    if (!el) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const all = $('.item__open, .dtable tbody tr');
      const next = all[all.indexOf(el) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) { next.focus(); selectBuilding(next.dataset.id); }
      return;
    }
    // Hàng của bảng dày không phải <button>, nên phải tự xử lý Enter/Space.
    if (el.tagName === 'TR' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); selectBuilding(el.dataset.id);
    }
  });

  $('#listscroll').addEventListener('mouseover', (e) => {
    const row = e.target.closest('.item');
    setHover(row ? row.dataset.id : null);
  });
  $('#listscroll').addEventListener('mouseleave', () => setHover(null));

  $('#tray-items').addEventListener('click', (e) => {
    const x = e.target.closest('[data-act="untray"]');
    if (x) toggleCompare(x.dataset.id);
  });
  $('#btn-tray-clear').addEventListener('click', () => {
    state.compare = []; renderTray(); map?.setCompare([]); renderList(state.visible);
  });
  $('#btn-compare').addEventListener('click', openCompare);

  $('#sheet-close').addEventListener('click', closeLayers);
  $('#overlay-close').addEventListener('click', closeLayers);
  $('#scrim').addEventListener('click', () => { state.cmdk.open ? closeCmdk() : closeLayers(); });

  for (const host of ['#sheet-body', '#overlay-body']) {
    $(host).addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const { act: a, id } = act.dataset;
      if (a === 'compare') { toggleCompare(id); act.setAttribute('aria-pressed', String(state.compare.includes(id))); }
      if (a === 'profile') { closeLayers(); setTimeout(() => { selectBuilding(id); openProfile(id); }, reducedMotion() ? 0 : 220); }
    });
  }

  // Tiêu chí ưu tiên trong bảng so sánh — do người dùng chọn, tối đa ba.
  // Chỉ LÀM NỔI hàng; không sinh điểm số, không xếp hạng.
  $('#overlay-body').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-prio]');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') === 'true';
    if (!on && $$('#cmp-prio [aria-pressed="true"]').length >= 3) {
      announce('Đã chọn đủ ba tiêu chí. Bỏ bớt một tiêu chí trước khi chọn thêm.'); return;
    }
    chip.setAttribute('aria-pressed', String(!on));
    const keys = new Set($$('#cmp-prio [aria-pressed="true"]').map((c) => c.dataset.prio));
    $$('#overlay-body tr[data-row]').forEach((tr) => tr.classList.toggle('is-priority', keys.has(tr.dataset.row)));
    announce(keys.size ? `Đã đánh dấu ${keys.size} tiêu chí.` : 'Đã bỏ đánh dấu tiêu chí.');
  });

  /* ---- Bảng lệnh ------------------------------------------------------- */
  const input = $('#cmdk-input');
  input.addEventListener('input', () => runCmdk(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdk(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdk(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); chooseCmdk(); }
  });
  $('#cmdk-list').addEventListener('click', (e) => {
    const opt = e.target.closest('.cmdk__opt');
    if (!opt) return;
    state.cmdk.index = Number(opt.dataset.i);
    chooseCmdk();
  });
  $('#cmdk-list').addEventListener('mousemove', (e) => {
    const opt = e.target.closest('.cmdk__opt');
    if (opt && Number(opt.dataset.i) !== state.cmdk.index) { state.cmdk.index = Number(opt.dataset.i); paintCmdkActive(); }
  });

  /* ---- Phím tắt toàn cục ----------------------------------------------- */
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); state.cmdk.open ? closeCmdk() : openCmdk(); return;
    }
    if (e.key === 'Escape') {
      if (state.cmdk.open) { e.preventDefault(); closeCmdk(); }
      else if (isLayerOpen()) { e.preventDefault(); closeLayers(); }
      return;
    }
    if (typing || state.cmdk.open) return;
    if (e.key === '/') { e.preventDefault(); openCmdk(); }
    if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleFilters(); }
  });

  // Đổi kích thước cửa sổ có thể lật bảng tiêu điểm từ cạnh trái xuống
  // đáy (ngưỡng 900px), tức đổi hẳn CHIỀU của phần bị che. Đo lại, đừng đoán.
  window.addEventListener('resize', () => { map?.resize(); syncMapPadding(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (ev) => {
    let stored = null;
    try { stored = localStorage.getItem('pi-theme'); } catch (err) { /* bị chặn */ }
    if (stored) return;                       // người dùng đã chọn thủ công
    document.documentElement.dataset.theme = ev.matches ? 'dark' : 'light';
    $('#ic-theme').innerHTML = icon(ev.matches ? 'sun' : 'moon', { size: 14 });
    map?.setTheme();
  });
}

function announce(msg) { $('#live').textContent = msg; }

/* Phơi ra cho kịch bản kiểm thử tự động. */
window.__pilot = {
  get state() { return state; },
  get map() { return map; },
  apply, selectBuilding, toggleCompare, openProfile, openCompare, openMethod, closeLayers,
  setView, resetFilters, toggleTheme, toggleMotion, toggleDensity, toggleFilters, openCmdk, closeCmdk,
};

/* =========================================================================
   CHÚ GIẢI THANG GIÁ

   Màu trên bản đồ chỉ mang nghĩa khi có chú giải, và thang được tính trên
   TẬP ĐANG HIỆN — lọc còn 20 tòa thì thang co lại theo 20 tòa đó. Vì vậy
   chú giải BẮT BUỘC cập nhật cùng lúc với bộ lọc; chú giải đứng yên trong
   khi thang đổi là nói dối về màu đang hiện.

   Nhãn đơn vị: `baseRent` trong bộ dữ liệu mang chú thích "đơn vị gốc chưa
   chuẩn hoá". Phân bố cho thấy nó nhất quán một đơn vị (hạng A trung vị
   60,6 > B 33,7 > C 19,7; CBD 28,9 > phân tán 15,9), nên SO SÁNH TƯƠNG ĐỐI
   — đúng thứ thang màu này thể hiện — là hợp lệ. Nhưng không được in
   "USD/m²/tháng" như thể đã kiểm chứng, nên chú giải gọi nó là "chỉ số giá"
   và nói thẳng giới hạn ra.
   ========================================================================= */
const RENT_RAMP_TOKENS = ['--r0', '--r1', '--r2', '--r3', '--r4'];

/* Chú giải giá: BIỂU ĐỒ PHÂN BỐ THẬT, không phải năm ô màu phẳng.

   Năm ô màu đều nhau nói được "có năm bậc" nhưng giấu mất hình dạng của dữ
   liệu. Mà hình dạng ở đây mới là điều đáng nói: giá lệch phải rất mạnh —
   trung vị 21,8 trong khi cực đại 70,0 — nghĩa là phần lớn tòa nhà nằm ở
   nửa rẻ, và một nhúm nhỏ kéo dài cái đuôi. Một dải màu phẳng không cho
   thấy điều đó; ba mươi cột thì cho thấy ngay.

   Mỗi cột vẫn tô đúng bậc mà bản đồ đang dùng, nên chú giải và bản đồ vẫn
   là một ngôn ngữ. Tòa đang chọn được đánh dấu bằng một vạch đứng: người
   dùng thấy ngay nó đứng ở đâu giữa toàn bộ tập.
   ========================================================================= */
const HIST_BINS = 30;

function paintRentKey(scale) {
  const box = $('#rentkey');
  if (!box) return;
  const hist = $('#rentkey-ramp');
  const note = $('#rentkey-note');

  if (!scale) {
    if (hist) hist.innerHTML = '';
    $('#rentkey-lo').textContent = '—';
    $('#rentkey-hi').textContent = '—';
    if (note) note.textContent = 'Không có tòa nào trong bộ lọc hiện tại.';
    return;
  }

  const vals = (state.visible || [])
    .filter((b) => isPresent(b.baseRent)).map((b) => b.baseRent.value);
  const span = (scale.max - scale.min) || 1;
  const bins = new Array(HIST_BINS).fill(0);
  for (const v of vals) {
    const k = Math.min(HIST_BINS - 1, Math.floor(((v - scale.min) / span) * HIST_BINS));
    bins[k]++;
  }
  const peak = Math.max(1, ...bins);

  if (hist) {
    hist.innerHTML = bins.map((c, i) => {
      const mid = scale.min + ((i + 0.5) / HIST_BINS) * span;
      const k = scale.bucket(mid);
      const h = Math.round((c / peak) * 100);
      return `<i style="height:${Math.max(c ? 8 : 2, h)}%;background:var(--r${k})"
        title="${esc(money(scale.min + (i / HIST_BINS) * span))}–${esc(money(scale.min + ((i + 1) / HIST_BINS) * span))}: ${c} tòa"></i>`;
    }).join('');
    hist.setAttribute('aria-label',
      `Phân bố giá thuê của ${scale.n} tòa đang hiện, từ ${money(scale.min)} đến ${money(scale.max)}, `
      + `trung vị ${money(vals.slice().sort((a, b) => a - b)[vals.length >> 1] ?? scale.min)}.`);
  }

  // Vạch đánh dấu tòa đang chọn — trả lời "tòa này đứng đâu trong cả tập"
  // ngay trên chính hình phân bố, không phải suy ra từ một con số phần trăm.
  const sel = state.selectedId && (state.visible || []).find((b) => b.id === state.selectedId);
  const mark = $('#rentkey-mark');
  if (mark) {
    if (sel && isPresent(sel.baseRent)) {
      const t = Math.max(0, Math.min(100, ((sel.baseRent.value - scale.min) / span) * 100));
      mark.style.left = `${t.toFixed(2)}%`;
      mark.hidden = false;
      mark.title = `${sel.name} · ${money(sel.baseRent.value)}`;
    } else {
      mark.hidden = true;
    }
  }

  $('#rentkey-lo').textContent = money(scale.min);
  $('#rentkey-hi').textContent = money(scale.max);
  if (note) {
    note.innerHTML = `${scale.n.toLocaleString('vi-VN')} tòa đang hiện · 5 mức màu
      <details class="rentkey__why"><summary>Cách đọc</summary>
        <p>Cột cao là nhiều tòa ở mức giá đó. Mỗi màu gồm khoảng một phần năm số tòa, từ rẻ đến đắt.
        Đổi bộ lọc thì thang tính lại.</p>
        <p>${esc(NHAN.giaDai)}, đơn vị USD/m²/tháng.</p>
      </details>`;
  }
}

/* =========================================================================
   BỘ CHỌN KHU VỰC — hai trục song song

   Bản trước: 19 chip quận + 48 chip phường trong hai hộp cuộn. Sáu mươi bảy
   ô vuông xếp cạnh nhau không phải là một bộ chọn — nó là một bức tường, và
   nó không cho biết cái nào liên quan cái nào.

   Bản này dựa trên hai sự thật ĐO ĐƯỢC từ chính bộ dữ liệu:

     1. Quận cũ → cụm thị trường là phân cấp SẠCH (0/19 quận nằm trên nhiều
        cụm). Nên bảy cụm gói gọn được mười chín quận: ở trạng thái nghỉ chỉ
        còn BẢY dòng, mở ra mới thấy quận bên trong.

     2. Phường mới KHÔNG lồng trong quận cũ. Sáu phường vắt qua nhiều quận
        (Gia Định trải Bình Thạnh + Q1, Xuân Hoà trải Q3 + Q2…). Sáp nhập
        2025 vẽ lại ranh giới nên hai hệ là hai TRỤC SONG SONG.

   Hệ quả thiết kế: KHÔNG dựng cây ba tầng. Hai chế độ, và chỗ vắt chéo được
   ghi thẳng lên chip thay vì giấu — vì đó chính là thứ gây nhầm khi người
   dùng đối chiếu địa chỉ cũ với địa chỉ mới.
   ========================================================================= */

/* Nhãn quận cũ trong bộ dữ liệu là tiếng Anh ("District 1", "Tan Binh").
   Giao diện là tiếng Việt nên phải dịch khi HIỂN THỊ — nhưng KHOÁ lọc vẫn
   giữ nguyên chuỗi gốc, vì đó là thứ khớp với dữ liệu. Dịch cả khoá là tự
   tạo một lớp ánh xạ nữa để sai. */
const DISTRICT_VI = {
  'District 1': 'Quận 1', 'District 2': 'Quận 2', 'District 3': 'Quận 3',
  'District 4': 'Quận 4', 'District 5': 'Quận 5', 'District 6': 'Quận 6',
  'District 7': 'Quận 7', 'District 8': 'Quận 8', 'District 9': 'Quận 9',
  'District 10': 'Quận 10', 'District 11': 'Quận 11', 'District 12': 'Quận 12',
  'Binh Thanh': 'Bình Thạnh', 'Binh Tan': 'Bình Tân', 'Binh Chanh': 'Bình Chánh',
  'Tan Binh': 'Tân Bình', 'Tan Phu': 'Tân Phú', 'Phu Nhuan': 'Phú Nhuận',
  'Go Vap': 'Gò Vấp', 'Thu Duc': 'Thủ Đức', 'Nha Be': 'Nhà Bè',
  'Hoc Mon': 'Hóc Môn', 'Cu Chi': 'Củ Chi', 'Can Gio': 'Cần Giờ',
};
const districtVi = (d) => DISTRICT_VI[d] || d;

function buildRegionPicker() {
  const b = state.data.buildings;

  /* ---- Trục 1: cụm thị trường, mở ra thành quận cũ --------------------- */
  const byMarket = new Map();
  for (const x of b) {
    if (!byMarket.has(x.submarket)) {
      byMarket.set(x.submarket, { label: x.submarketLabel, n: 0, districts: new Map() });
    }
    const m = byMarket.get(x.submarket);
    m.n++;
    if (x.legacyDistrict) m.districts.set(x.legacyDistrict, (m.districts.get(x.legacyDistrict) || 0) + 1);
  }
  const markets = [...byMarket.entries()].sort((p, q) => q[1].n - p[1].n);

  $('#f-market').innerHTML = markets.map(([key, m]) => {
    const ds = [...m.districts.entries()].sort((p, q) => q[1] - p[1]);
    return `<div class="mkt" data-market="${esc(key)}">
      <div class="mkt__row">
        <button class="mkt__pick" type="button" data-sub="${esc(key)}" aria-pressed="false">
          <span class="mkt__name">${esc(m.label)}</span>
          <span class="mkt__n">${m.n}</span>
        </button>
        <button class="mkt__more" type="button" aria-expanded="false"
          aria-label="Mở ${esc(ds.length)} quận cũ trong ${esc(m.label)}">
          <span class="mkt__chev" aria-hidden="true"></span>
        </button>
      </div>
      <div class="mkt__kids" hidden>
        ${ds.map(([d, n]) => `<button class="togglechip togglechip--sm" type="button"
            data-legacy="${esc(d)}" aria-pressed="false">${esc(districtVi(d))}<span class="togglechip__n">${n}</span></button>`).join('')}
      </div>
    </div>`;
  }).join('');

  // Mở/đóng danh sách quận trong một cụm.
  $('#f-market').addEventListener('click', (e) => {
    const more = e.target.closest('.mkt__more');
    if (!more) return;
    const kids = more.closest('.mkt').querySelector('.mkt__kids');
    const open = more.getAttribute('aria-expanded') !== 'true';
    more.setAttribute('aria-expanded', String(open));
    kids.hidden = !open;
  });

  /* ---- Trục 0: QUẬN CŨ, phẳng và là mặc định ---------------------------
     Người trong ngành gọi khu vực theo tên quận cũ hằng ngày ("văn phòng
     Quận 1", "giá Bình Thạnh"), nên đây phải là cách chọn ĐẦU TIÊN, không
     phải thứ nằm sau một lần mở cụm. Mười chín mục vẫn đọc hết được trong
     một khung cuộn — không cần gói lại.

     Cụm thị trường vẫn còn ở tab bên cạnh: nó trả lời câu KHÁC — "vùng nào
     hành xử giống nhau về giá" — chứ không phải "chỗ này tên gì".        */
  const dMap = new Map();
  for (const x of b) {
    if (!x.legacyDistrict) continue;
    if (!dMap.has(x.legacyDistrict)) dMap.set(x.legacyDistrict, { n: 0, sub: new Set() });
    const d = dMap.get(x.legacyDistrict);
    d.n++;
    if (x.submarketLabel) d.sub.add(x.submarketLabel);
  }
  const districts = [...dMap.entries()].sort((p, q) => q[1].n - p[1].n);
  $('#f-district').innerHTML = districts.map(([key, d]) => `<button class="wardrow" type="button"
    data-legacy="${esc(key)}" aria-pressed="false">
    <span class="wardrow__name">${esc(districtVi(key))}</span>
    <span class="wardrow__cross">${esc([...d.sub].join(' · '))}</span>
    <span class="wardrow__n">${d.n}</span></button>`).join('');

  /* ---- Trục 2: phường/xã hiện hành ------------------------------------- */

  // Một phường vắt qua nhiều quận cũ là THÔNG TIN, không phải lỗi dữ liệu.
  // Ghi nó lên chip: đây đúng là chỗ người dùng nhầm khi đối chiếu địa chỉ
  // cũ với địa chỉ mới sau sáp nhập.
  const wardMap = new Map();
  for (const x of b) {
    if (!x.currentWard) continue;
    if (!wardMap.has(x.currentWard)) wardMap.set(x.currentWard, { n: 0, districts: new Set() });
    const w = wardMap.get(x.currentWard);
    w.n++;
    if (x.legacyDistrict) w.districts.add(x.legacyDistrict);
  }
  const wards = [...wardMap.entries()].sort((p, q) => q[1].n - p[1].n);
  const crossing = wards.filter(([, w]) => w.districts.size > 1);

  $('#f-current-ward').innerHTML = wards.map(([name, w]) => {
    const cross = w.districts.size > 1;
    const list = [...w.districts].map(districtVi).join(' · ');
    return `<button class="wardrow${cross ? ' is-cross' : ''}" type="button"
      data-ward="${esc(name)}" data-search="${esc(name.toLowerCase())}" aria-pressed="false"
      ${cross ? `title="Phường này trải trên ${w.districts.size} quận cũ: ${esc(list)}"` : ''}>
      <span class="wardrow__name">${esc(name)}</span>
      ${cross ? `<span class="wardrow__cross">vắt qua ${esc(list)}</span>` : ''}
      <span class="wardrow__n">${w.n}</span>
    </button>`;
  }).join('');

  const unresolved = b.filter((x) => !x.currentWard).length;
  $('#ward-filter-note').innerHTML =
    `${wards.length} phường có tòa nhà · ${unresolved} tòa chưa xác định phường. `
    + `${crossing.length} phường trải trên nhiều quận cũ.`;

  /* ---- Đổi chế độ ------------------------------------------------------ */
  $$('[data-region-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.regionMode;
      $$('[data-region-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === btn)));
      $('#region-pane-district').hidden = mode !== 'district';
      $('#region-pane-market').hidden = mode !== 'market';
      $('#region-pane-ward').hidden = mode !== 'ward';
    });
  });

  // Lọc danh sách phường theo ô tìm.
  $('#f-ward-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    let hit = 0;
    $$('#f-current-ward .wardrow').forEach((row) => {
      const ok = !q || row.dataset.search.includes(q);
      row.hidden = !ok;
      if (ok) hit++;
    });
    $('#region-pane-ward').dataset.empty = hit === 0 ? '1' : '';
  });
}

/* =========================================================================
   KHUNG QUY CHIẾU CHO CON SỐ GIÁ

   "7,9 · đơn vị gốc" là một câu đúng nhưng vô dụng: người đọc không biết 7,9
   là rẻ hay đắt, và "đơn vị gốc" không gợi ra bất cứ mức nào. Nhãn cũ trung
   thực nhưng không mang thông tin.

   Thay bằng VỊ TRÍ TRONG PHÂN BỐ — thứ mà con số trần không có, và là thứ
   người đi thuê thật sự cần: rẻ hơn bao nhiêu phần trăm số tòa đang xét.

   Màu của huy hiệu lấy đúng bậc mà BẢN ĐỒ đang tô cho tòa đó, qua cùng một
   hàm thang. Nhờ vậy danh sách và bản đồ nói cùng một ngôn ngữ: thấy chấm
   đậm trên bản đồ thì tìm được thẻ mang huy hiệu đậm trong danh sách.
   ========================================================================= */
function rentBandChip(b) {
  const sc = state.rentScale;
  if (!sc || !isPresent(b.baseRent)) return '<span class="item__unit">USD/m²/tháng</span>';
  const k = sc.bucket(b.baseRent.value);
  if (k < 0) return '<span class="item__unit">USD/m²/tháng</span>';
  const band = RENT_BANDS[k];
  return `<span class="bandchip" style="background:var(--r${k});color:var(--on-r${k})"
    title="Giá ${esc(money(b.baseRent.value))}: thuộc ${esc(band.label)} trong ${sc.n} tòa đang hiện">${esc(band.short)}</span>
    <span class="item__unit">${rentPosPhrase(b.baseRent.value, sc)}</span>`;
}

/* Câu vị trí giá. 01/10 sửa lỗi NGƯỢC NGHĨA: bản trước ghi "rẻ hơn X% số tòa" với X = % số tòa có giá THẤP hơn, tức tòa đó
   thật ra ĐẮT hơn X%. Nay: nửa dưới nói "rẻ hơn" (theo % tòa giá cao hơn), nửa trên nói "đắt hơn" (theo % tòa giá thấp hơn);
   chỉ tòa có đúng giá thấp nhất hoặc cao nhất mới được gọi "rẻ nhất"/"đắt nhất". */
function rentPosPhrase(v, sc) {
  if (v <= sc.min) return `rẻ nhất trong ${sc.n.toLocaleString('vi-VN')} tòa đang hiện`;
  if (v >= sc.max) return `đắt nhất trong ${sc.n.toLocaleString('vi-VN')} tòa đang hiện`;
  const toaReHon = sc.pctBelow(v);   // % tòa có giá thấp hơn tòa này
  const toaDatHon = sc.pctAbove(v);  // % tòa có giá cao hơn tòa này
  return toaReHon >= 50 ? `đắt hơn ${toaReHon}% số tòa` : `rẻ hơn ${toaDatHon}% số tòa`;
}

/* Thanh VỊ TRÍ TRONG BIÊN ĐỘ, thay cho thanh cấu thành giá.

   Thanh cũ vẽ ba thành phần base + phí dịch vụ + VAT. Nhưng trong bộ dữ liệu
   này phí dịch vụ và VAT là `not_collected` ở CẢ 407 hồ sơ, nên thanh cũ chỉ
   còn một đoạn duy nhất — và tệ hơn, nó gợi ý rằng có ba thành phần trong
   khi hai trong ba chưa từng được thu thập.

   Thanh mới trả lời đúng câu người đọc đang hỏi: tòa này nằm ở đâu giữa rẻ
   nhất và đắt nhất của tập đang xét. */
function rentPosBar(b) {
  const sc = state.rentScale;
  if (!sc || !isPresent(b.baseRent)) return '';
  const v = b.baseRent.value;
  const k = sc.bucket(v);
  const t = Math.max(0, Math.min(100, ((v - sc.min) / ((sc.max - sc.min) || 1)) * 100));
  return `<span class="posbar" role="img"
    aria-label="Giá ${esc(money(v))}, trong khoảng ${esc(money(sc.min))} đến ${esc(money(sc.max))} của ${sc.n} tòa đang hiện">
    <span class="posbar__fill" style="width:${t.toFixed(1)}%;background:var(--r${Math.max(1, k)})"></span>
  </span>`;
}

/* Thời gian lái xe tới trung tâm và sân bay, trên thẻ danh sách.

   Trường này có ở 400/407 hồ sơ và trước đây chỉ nằm trong hồ sơ chi tiết —
   tức người dùng phải mở từng tòa mới thấy. Với người đi thuê văn phòng thì
   "bao lâu tới trung tâm" là câu hỏi ngang hàng với giá, nên nó thuộc về thẻ.

   Chỉ lấy MỘT bản ghi mỗi đích: ba nhãn giờ trong dữ liệu trả về cùng một
   kết quả (xem mục 7 của TIEN_DO.md), nên hiện ba con số là hiện một con số
   ba lần. */
function driveRow(b) {
  const rec = state.drivingData?.buildings?.[b.id];
  if (!rec) return '';
  const bits = [];
  if (rec.cbd?.minMinutes) bits.push(`Trung tâm <b>${rec.cbd.minMinutes}–${rec.cbd.maxMinutes} ph</b>`);
  if (rec.airport?.minMinutes) bits.push(`sân bay <b>${rec.airport.minMinutes}–${rec.airport.maxMinutes} ph</b>`);
  if (!bits.length) return '';
  return `<div class="item__row" title="Thời gian lái xe ước tính, thay đổi theo giờ trong ngày">
    ${icon('car', { size: 13 })}<span>${bits.join(' · ')} <em class="item__when">tuỳ giờ</em></span></div>`;
}

/* =========================================================================
   PHỦ SÓNG CỦA LỚP ĐI BỘ — tiện ích và isochrone

   `osm_amenities.json` và `osm_isochrones.json` được dựng cho bản thử 12 tòa
   và khoá theo id kiểu `CB_…`. Bộ dữ liệu V8.1 dùng id `TCH2_…`. Đo được:
   GIAO NHAU BẰNG 0 — tức lớp tiện ích, tuyến đi bộ và vùng isochrone KHÔNG
   BAO GIỜ hiện được cho bất kỳ tòa nào trong 407.

   Bản thân bảng tiện ích thì tự ẩn khi không có dữ liệu, nên nó không hỏng
   ra mặt. Nhưng CHÚ GIẢI vẫn quảng cáo "Vùng đi bộ thật · trong 5/10/15
   phút" — hứa một lớp không thể xuất hiện. Quảng cáo thứ không có còn tệ hơn
   là không có, vì người dùng sẽ đi tìm.

   Nên: đo phủ sóng lúc chạy, và nếu bằng 0 thì thay chú giải đó bằng lời nói
   thẳng. Khi nào dựng lại dữ liệu cho 407 tòa thì chú giải tự hiện lại,
   không phải sửa mã.
   ========================================================================= */
function checkWalkLayerCoverage() {
  const ids = new Set(state.data.buildings.map((b) => b.id));
  const covered = (obj) => Object.keys(obj?.buildings || {}).filter((k) => ids.has(k)).length;
  const nAm = covered(state.amenityData);
  const nIso = covered(state.isoData);
  state.walkCoverage = { amenities: nAm, isochrones: nIso, total: ids.size };

  const box = $('.isokey');
  if (!box) return;
  if (nAm > 0 || nIso > 0) return;          // có phủ sóng: giữ nguyên chú giải

  box.innerHTML = `<span class="label" style="margin-bottom:2px">Vùng đi bộ và tiện ích</span>
    <p class="maplegend__note" style="margin:0">${icon('dashCircle', { size: 12 })}
      Chưa có dữ liệu cho các tòa nhà này.</p>`;
  box.classList.add('isokey--none');
}

/* =========================================================================
   TIỆN ÍCH GẦN NHẤT TRONG BẢNG TIÊU ĐIỂM

   Vì sao khối này tồn tại: bấm vào một chấm trên bản đồ trước đây chỉ làm
   sáng dòng trong danh sách bên trái. Người dùng nói đúng — "chẳng có thông
   tin gì cả".

   Trong khi đó payload có sẵn, cho 400/407 hồ sơ, **4.000 địa điểm** chia
   mười nhóm, mỗi địa điểm kèm QUÃNG ĐI BỘ và THỜI GIAN ĐI BỘ thật
   (`walkingDistanceM`, `walkingDurationS`, chọn theo mạng đường —
   `WALKING_NETWORK_BEST_OF_GEODESIC_TOP3`). Toàn bộ chỗ đó chỉ hiện trong
   hồ sơ sâu, tức phải bấm thêm một lần nữa mới thấy.

   Bảng tiện ích cũ trong khung này lấy từ `osm_amenities.json` — tệp khoá
   theo id bản thử 12 tòa, giao nhau với 407 hồ sơ bằng 0, nên nó không bao
   giờ hiện. Khối này thay chỗ đó.

   RÀNG BUỘC: đây là dữ liệu Google Places. Nó nằm ở DẠNG DANH SÁCH, không
   vẽ lên nền bản đồ OpenStreetMap — giữ đúng ranh giới mà kiểm thử C-1 canh.
   ========================================================================= */
const walkMin = (s) => (s == null ? null : Math.max(1, Math.round(s / 60)));

function renderFocusAmenities(b) {
  /* ƯU TIÊN OPENSTREETMAP. Chỉ rơi về tập Google Places khi hồ sơ chưa có
     trong tệp OSM — và khi rơi về thì nói ra, vì hai tập khác nhau về cả
     phương pháp chọn lẫn loại khoảng cách. */
  const osmEntry = state.amenityData?.buildings?.[b.id];
  if (osmEntry?.categories?.some((c) => c.places?.length)) {
    return renderFocusAmenitiesOsm(b, osmEntry);
  }
  const groups = (b.amenities || []).filter((g) => g.places && g.places.length);
  if (!groups.length) {
    return `<div class="famen famen--none">${missingChip(FieldState.NOT_COLLECTED,
    'Tòa này chưa có dữ liệu tiện ích.')}</div>`;
  }

  /* HAI LOẠI KHOẢNG CÁCH, KHÔNG ĐƯỢC TRỘN.

     Đo trên toàn bộ 4.000 địa điểm: chỉ nhóm `bus` có quãng và thời gian đi
     bộ theo mạng đường (400/400). Chín nhóm còn lại CHỈ có khoảng cách chim
     bay (4.000/4.000 có `distanceM`, 0 có `walkingDurationS`).

     Nên bản đầu của khối này sắp xếp theo phút đi bộ là sai: chín nhóm rơi
     hết xuống cùng một giá trị vô cực và thứ tự hiện ra là thứ tự tình cờ
     trong tệp. Nó cũng in "—" cho chín nhóm trong khi thực tế CÓ số đo, chỉ
     là loại khác.

     Cách đúng: xếp theo mét — dùng quãng đi bộ khi có, chim bay khi không —
     và NÓI RÕ TỪNG DÒNG đang là loại nào. Không bao giờ suy ra phút đi bộ
     từ đường chim bay: hệ số vòng ở TP.HCM thay đổi quá lớn để đoán. */
  const rows = groups.map((g) => {
    const best = [...g.places].sort((x, y) => {
      const mx = x.walkingDistanceM ?? x.distanceM ?? Infinity;
      const my = y.walkingDistanceM ?? y.distanceM ?? Infinity;
      return mx - my;
    })[0];
    const m = best.walkingDistanceM ?? best.distanceM ?? Infinity;
    return { g, p: best, m, walk: best.walkingDurationS != null };
  }).sort((x, y) => x.m - y.m);

  const near = rows.filter((r) => r.m <= 500).length;

  return `<div class="famen">
    <div class="famen__head">
      <span class="label">Tiện ích gần nhất</span>
      <span class="famen__sum"><b>${near}</b>/${rows.length} nhóm trong <b>500 m</b></span>
    </div>
    <ol class="famen__list">
      ${rows.map(({ g, p, walk }) => {
    const mins = p.walkingDurationS != null ? Math.max(1, Math.round(p.walkingDurationS / 60)) : null;
    const d = p.walkingDistanceM ?? p.distanceM;
    /* TUYẾN ĐƯỜNG NGẮN NHẤT TỚI ĐỊA ĐIỂM.

       Không vẽ tuyến lên nền OpenStreetMap, vì hai lý do độc lập:
       1. Đây là dữ liệu Google Places; ranh giới hai nguồn vẫn giữ.
       2. Bản thử KHÔNG có đồ thị đường đi bộ cho 407 tọa độ, nên mọi
          đường vẽ ra sẽ là đường thẳng — mà đường thẳng gọi là "tuyến"
          thì sai hẳn: hệ số vòng ở TP.HCM thay đổi rất lớn.

       Nên mở thẳng chỉ đường ĐI BỘ của Google, tính từ đúng tọa độ tòa
       nhà. Đó là tuyến thật, do bên có đồ thị đường tính. */
    const dir = `https://www.google.com/maps/dir/?api=1`
      + `&origin=${encodeURIComponent(b.lat + ',' + b.lng)}`
      + `&destination=${encodeURIComponent(p.name)}`
      + (p.placeId ? `&destination_place_id=${encodeURIComponent(p.placeId)}` : '')
      + `&travelmode=walking`;
    const nameHtml = `<a href="${esc(dir)}" target="_blank" rel="noopener noreferrer"
      title="Mở chỉ đường đi bộ từ ${esc(b.name)} tới ${esc(p.name)} trên Google Maps">${esc(p.name)}</a>`;
    return `<li class="famen__row${p.operational ? '' : ' is-closed'}">
        <span class="famen__ic" aria-hidden="true">${icon(amenityIcon[g.key] || g.key, { size: 13 })}</span>
        <span class="famen__who">
          <b>${nameHtml}</b>
          <i>${esc(g.label)}${p.operational ? '' : ' · ngừng hoạt động'}</i>
        </span>
        <span class="famen__num">
          <b>${d != null ? esc(distance(d)) : '—'}</b>
          <i class="${walk ? 'is-walk' : ''}">${walk
    ? `${mins} ph đi bộ`
    : 'chim bay'}</i>
        </span>
      </li>`;
  }).join('')}
    </ol>
    <p class="famen__note">Bấm tên địa điểm để xem đường đi bộ trên Google Maps. Trạm xe buýt tính
      theo đường đi bộ; các nhóm khác là khoảng cách đường thẳng. Nguồn: Google Places.</p>
  </div>`;
}

/* Cờ chất lượng dữ liệu của chính hồ sơ đang xem.

   Bộ dữ liệu đánh dấu 19 hồ sơ cần soát lại phường và 20 hồ sơ nằm sát ranh
   giới phường, nhưng trước đây giao diện không hiện cờ này ở đâu — trong khi
   bộ lọc theo phường lại dựa thẳng vào trường đó. Người lọc theo phường mà
   không biết hồ sơ nào đáng ngờ thì lọc ra một kết quả tưởng chắc chắn. */
function renderFocusFlags(b) {
  const f = [];
  if (b.currentWardNeedsReview) {
    f.push({ t: 'warn', s: 'Phường cần kiểm lại',
      d: 'Phường theo địa chỉ khác phường theo vị trí trên bản đồ.' });
  }
  if (b.currentWardNearBoundary) {
    f.push({ t: 'warn', s: 'Gần ranh giới phường',
      d: b.currentWardBoundaryDistanceM != null ? `Cách ranh giới khoảng ${Math.round(b.currentWardBoundaryDistanceM)} m.` : '' });
  }
  if (b.coordinateVerified === false) {
    f.push({ t: 'warn', s: 'Chưa có tọa độ',
      d: 'Tòa này chưa hiện trên bản đồ.' });
  }
  if (!f.length) return '';
  return `<div class="fflags">${f.map((x) => `<div class="fflag fflag--${x.t}">
    ${icon('alert', { size: 12 })}<span><b>${esc(x.s)}</b> ${esc(x.d)}</span></div>`).join('')}</div>`;
}

/* Thời gian lái xe trong bảng tiêu điểm. Cùng một quan sát với thẻ danh
   sách, nhưng ở đây có chỗ nói thêm quãng đường và hệ số ùn tắc. */
/* LÁI XE — quãng đường OSM, thời gian là một DẢI chứ không phải một con số.

   Vì sao dải. Ba nguồn độc lập cho tốc độ ô tô ở TP.HCM:
     · Sở GTVT TP.HCM        21 km/h ngoài cao điểm → 12 km/h giờ cao điểm
     · bộ cũ, không xét tắc  16,3 km/h
     · bộ cũ, đo lúc 08:04   17,0 km/h
   Tức chênh gần HAI LẦN tuỳ giờ. Một con số điểm giấu mất đúng điều đó và là
   chính xác giả. Dải nói thẳng "10 tới 17 phút tuỳ lúc đi" — và đó mới là
   thứ người thuê văn phòng cần để lên lịch.

   Thời gian mặc định của OSRM bị LOẠI: nó suy ra 43,7 km/h, tức hồ sơ tốc độ
   thông thoáng, lệch 2,5–3,6 lần so với cả ba nguồn quan sát. Quãng đường
   của OSRM thì giữ — đã kiểm, lệch 0,7% so với bộ cũ. */
function renderFocusDrive(b) {
  const rec = state.drivingData?.buildings?.[b.id];
  if (!rec) return '';
  const cell = (t, label) => {
    if (!t || t.distanceM == null) return '';
    const km = (t.distanceM / 1000).toFixed(1).replace('.', ',');
    return `<div class="fdrive__cell">
      <span class="fdrive__lab">${esc(label)}</span>
      <span class="fdrive__val"><b>${km}</b> km</span>
      <span class="fdrive__sub">${t.minMinutes}–${t.maxMinutes} phút tuỳ giờ</span>
    </div>`;
  };
  const body = cell(rec.cbd, 'Trung tâm') + cell(rec.airport, 'Sân bay');
  if (!body) return '';
  return `<div class="fdrive">
    <div class="famen__head"><span class="label">Lái xe</span>
      <span class="famen__sum">OpenStreetMap</span></div>
    <div class="fdrive__grid">${body}</div>
    <p class="famen__note">Thời gian tính với tốc độ trung bình 21 km/h ngoài giờ cao điểm và
      12 km/h giờ cao điểm (7–9h, 17–19h), theo Sở GTVT TP.HCM.</p>
  </div>`;
}

/* =========================================================================
   BẤM CHỌN KHU VỰC LÀ BAY TỚI KHU VỰC ĐÓ

   Trước đây chọn một cụm hoặc một phường chỉ lọc danh sách; bản đồ đứng
   nguyên ở khung nhìn cũ. Người dùng phải tự tìm xem khu vực vừa chọn nằm
   đâu — trong khi máy đã biết chính xác.

   Khung nhìn tính từ HỘP BAO của chính các tòa vừa lọc, không phải từ ranh
   giới hành chính: hộp bao đúng bằng thứ đang hiện, nên không bao giờ bay
   tới một vùng trống. Nếu chỉ còn một tòa thì fitBounds một điểm sẽ phóng
   tới mức tối đa, nên trường hợp đó bay tới tâm ở mức vừa phải.
   ========================================================================= */
function flyToSelection() {
  if (!map || !state.visible?.length) return;
  const ids = state.visible.map((b) => b.id);
  if (ids.length === 1) {
    const b = state.visible[0];
    const t = { center: [b.lng, b.lat], zoom: 15.6 };
    if (reducedMotion()) map.map.jumpTo(t); else map.map.flyTo({ ...t, duration: 620 });
    return;
  }
  map.fitTo(ids);
}

/* Nút "Chọn khu vực…" trên bản đồ: mở bộ lọc và đưa mắt tới đúng khối, thay
   vì nhân bản bộ chọn. Hai bản sao của cùng một bộ lọc sẽ lệch nhau. */
function wireRegionJump() {
  const btn = $('#btn-goregion');
  if (!btn) return;
  btn.addEventListener('click', () => {
    toggleFilters(true);
    const box = $('.region');
    if (!box) return;
    box.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    box.classList.add('is-flash');
    setTimeout(() => box.classList.remove('is-flash'), 900);
    $('[data-region-mode="market"]')?.focus();
  });
}

/* =========================================================================
   TIỆN ÍCH GẦN NHẤT — ƯU TIÊN OPENSTREETMAP

   Người dùng yêu cầu chuyển hoàn toàn sang dữ liệu OpenStreetMap. Khối này
   đọc `osm_amenities.json` trước; chỉ khi hồ sơ đó chưa có trong tệp OSM mới
   rơi về tập Google Places trong payload, và khi rơi về thì NÓI RA.

   Vì sao OSM tốt hơn ở đây, không chỉ vì "mở":
     · có QUÃNG ĐI BỘ THẬT cho MỌI nhóm, không phải mỗi nhóm xe buýt
     · có HÌNH HỌC TUYẾN nên vẽ được đường đi lên chính bản đồ này
     · cùng giấy phép với nền bản đồ nên không phải tách hai nguồn
     · hệ số vòng (đi bộ / chim bay) tính được, và nó là con số nói lên
       nhiều điều nhất về khả năng đi bộ thật
   ========================================================================= */

/** Chỉ đường ĐI BỘ trên hạ tầng mở: OSRM của FOSSGIS, chạy trên dữ liệu OSM. */
function osmFootRoute(fromLat, fromLng, toLat, toLng) {
  return 'https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot'
    + `&route=${fromLat.toFixed(6)},${fromLng.toFixed(6)};${toLat.toFixed(6)},${toLng.toFixed(6)}`;
}

function renderFocusAmenitiesOsm(b, entry) {
  const rows = (entry.categories || [])
    .map((c) => {
      // Cùng bộ lọc mà bản đồ dùng: nhóm ẩn trả về null, nhóm "Trạm xe buýt"
      // chỉ còn đúng trạm buýt. Bảng và bản đồ phải kể cùng một câu chuyện.
      const usable = amenityPlaces(c.key, c.places);
      if (!usable?.length) return null;
      const p = [...usable].sort((x, y) => (x.walkM ?? 1e9) - (y.walkM ?? 1e9))[0];
      return { c, p };
    })
    .filter(Boolean)
    .sort((x, y) => (x.p.walkM ?? 1e9) - (y.p.walkM ?? 1e9));

  if (!rows.length) return '';
  const near = rows.filter((r) => (r.p.walkMin ?? 99) <= 10).length;

  return `<div class="famen">
    <div class="famen__head">
      <span class="label">Tiện ích gần nhất</span>
      <span class="famen__sum"><b>${near}</b>/${rows.length} nhóm trong <b>10 phút</b> đi bộ</span>
    </div>
    <ol class="famen__list">
      ${rows.map(({ c, p }) => {
    const detour = p.detourRatio != null ? String(p.detourRatio).replace('.', ',') : null;
    const href = osmFootRoute(b.lat, b.lng, p.lat, p.lng);
    return `<li class="famen__row" data-osmrid="${esc(String(p.osmId || ''))}"
        data-lat="${p.lat}" data-lng="${p.lng}">
        <span class="famen__ic" aria-hidden="true">${icon(OSM_CAT_ICON[c.key] || 'mapPin', { size: 13 })}</span>
        <span class="famen__who">
          <b><a href="${esc(href)}" target="_blank" rel="noopener noreferrer"
            title="Xem đường đi bộ trên OpenStreetMap">${esc(p.name)}</a></b>
          <i>${esc(amenityLabel(c.key))}${detour ? ` · vòng ${detour}×` : ''}</i>
        </span>
        <span class="famen__num">
          <b>${p.walkMin} ph</b>
          <i class="is-walk">${esc(distance(p.walkM))} đi bộ</i>
        </span>
      </li>`;
  }).join('')}
    </ol>
    <p class="famen__note">Rê chuột lên một dòng để xem đường đi bộ trên bản đồ. Phút đi bộ tính
      theo đường thật, 75 m/phút; "vòng" là quãng đi bộ chia cho khoảng cách đường thẳng.
      Nguồn: OpenStreetMap.</p>
  </div>`;
}

/* Ánh xạ tám nhóm của tệp OSM sang bộ biểu tượng có sẵn. Bộ biểu tượng được
   đặt tên theo mười nhóm Google, nên hai bên không trùng khoá. */
const OSM_CAT_ICON = {
  food: 'restaurant', banking: 'bank_atm', transit: 'bus',
  convenience: 'convenience_store', health: 'healthcare',
  fitness: 'park', hotel: 'hotel', parking: 'parking',
};

/* =========================================================================
   BẢNG CHỌN KHI BẤM VÀO MỘT CỤM

   Ở mức phóng mặc định có 36 cụm và chỉ 27 chấm đơn — tức phần lớn cú bấm
   rơi vào cụm. Bản trước chỉ phóng to và không hiện gì, nên người dùng bấm
   mãi không thấy bảng nào và kết luận tính năng không tồn tại. Họ đúng: một
   cú bấm không trả lời gì là một cú bấm hỏng.

   Bảng này liệt kê các tòa trong cụm, xếp theo giá, mỗi dòng mang đúng huy
   hiệu bậc giá như trên bản đồ và trong danh sách — nên ba bề mặt nói cùng
   một ngôn ngữ. Bấm một dòng là mở hồ sơ tiêu điểm đầy đủ.
   ========================================================================= */
function showClusterPicker(ids) {
  const host = $('#focus');
  if (!host) return;
  const list = ids
    .map((id) => state.data.buildings.find((b) => b.id === id))
    .filter(Boolean)
    .sort((a, z) => {
      const av = isPresent(a.baseRent) ? a.baseRent.value : -1;
      const zv = isPresent(z.baseRent) ? z.baseRent.value : -1;
      return zv - av;
    });
  if (!list.length) return;
  if (list.length === 1) { selectBuilding(list[0].id, { from: 'map' }); return; }

  state.selectedId = null;
  host.hidden = false;
  $('.mapcol')?.classList.toggle('has-focus', true);
  $('#focus-stub').textContent = `${list.length} tòa nhà tại đây`;
  if ($('#focus-scroll')) $('#focus-scroll').scrollTop = 0;
  state.focusFor = null;

  const sc = state.rentScale;
  $('#focus-building').innerHTML = `
    <div class="cpick">
      <div class="cpick__head">
        <h3 class="fbuild__name">${list.length} tòa nhà ở khu vực này</h3>
        <p class="fbuild__addr">Chọn một tòa để xem chi tiết.</p>
      </div>
      <ol class="cpick__list">
        ${list.map((b) => {
    const has = isPresent(b.baseRent);
    const k = has && sc ? sc.bucket(b.baseRent.value) : -1;
    return `<li><button class="cpick__row" type="button" data-cpick="${esc(b.id)}">
          <span class="cpick__num">${has ? esc(money(b.baseRent.value)) : '—'}</span>
          <span class="cpick__who">
            <b>${esc(b.name)}</b>
            <i>${esc(b.districtLabel || '')}${b.gradeLabel ? ` · ${esc(b.gradeLabel)}` : ''}</i>
          </span>
          ${k >= 0 ? `<span class="cpick__band" style="background:var(--r${k})" aria-hidden="true"></span>` : ''}
        </button></li>`;
  }).join('')}
      </ol>
    </div>`;

  $('#focus-building').onclick = (e) => {
    const btn = e.target.closest('[data-cpick]');
    if (!btn) return;
    selectBuilding(btn.dataset.cpick, { from: 'map' });
  };
  syncMapPadding();
}

/* =========================================================================
   NỐI DÒNG TIỆN ÍCH ↔ TUYẾN TRÊN BẢN ĐỒ

   Quy tắc chống rối, rút từ đúng lỗi đã mắc ở bản trước:
     · mặc định KHÔNG tuyến nào được vẽ
     · rê một dòng → vẽ ĐÚNG một tuyến, phần còn lại không tồn tại
     · rời chuột → tuyến biến mất
     · bấm → khung nhìn ôm trọn tòa nhà và địa điểm, tuyến giữ nguyên

   Dùng uỷ quyền sự kiện trên vùng cha: bảng vẽ lại mỗi lần đổi tòa nhà, nên
   gắn tám bộ nghe cho mỗi lần vẽ sẽ rò bộ nhớ.
   ========================================================================= */
function wireFocusAmenityRoutes() {
  const host = $('#focus-scroll');
  if (!host || host.dataset.wiredRoutes) return;
  host.dataset.wiredRoutes = '1';

  const rowOf = (e) => e.target.closest('.famen__row[data-osmrid]');

  host.addEventListener('mouseover', (e) => {
    const row = rowOf(e);
    if (!row) return;
    map?.highlightByOsmId(row.dataset.osmrid);
  });
  host.addEventListener('mouseleave', () => map?.highlightRoute(null));
  host.addEventListener('focusin', (e) => {
    const row = e.target.closest('.famen__row[data-osmrid]');
    if (row) map?.highlightByOsmId(row.dataset.osmrid);
  });
  host.addEventListener('click', (e) => {
    // Bấm vào LIÊN KẾT thì để nó mở chỉ đường, không chiếm sự kiện.
    if (e.target.closest('a')) return;
    const row = rowOf(e);
    if (!row) return;
    const b = state.data.buildings.find((x) => x.id === state.selectedId);
    if (!b) return;
    map?.highlightByOsmId(row.dataset.osmrid);
    map?.fitToPair(b.lat, b.lng, Number(row.dataset.lat), Number(row.dataset.lng));
  });
}

/* =========================================================================
   MẬT ĐỘ TIỆN ÍCH + ĐA DẠNG — biến nghiên cứu, đặt TRÊN danh sách gần nhất

   Thứ tự trong bảng có chủ đích: khối này nằm TRƯỚC danh sách "gần nhất".
   Lý do là học thuật, không phải thẩm mỹ — "khoảng cách tới cái gần nhất" là
   biến nhiễu (một điểm gắn sai là đủ hỏng chỉ số), còn số đếm trong bán kính
   thì ổn định. Cái đáng tin phải đọc trước.

   Danh sách gần nhất vẫn giữ: nó hữu ích khi xem MỘT tòa cụ thể. Chỉ là nó
   không được đứng đầu như thể là biến chính.
   ========================================================================= */
const DENS_CATS = [
  ['food', 'Ăn uống'], ['banking', 'Ngân hàng'], ['transit', 'Đi lại'],
  ['convenience', 'Mua sắm'], ['health', 'Y tế'], ['fitness', 'Thể thao'],
  ['hotel', 'Khách sạn'], ['parking', 'Bãi đỗ xe'],
];

/** Bách phân vị của một tòa trong toàn bộ tập — cho con số một khung quy chiếu. */
function densPercentile(value, radius) {
  const all = Object.values(state.densityData?.buildings || {})
    .filter((r) => r && !r._unreachable && r.total && r.total[radius] != null)
    .map((r) => r.total[radius]).sort((a, b) => a - b);
  if (!all.length) return null;
  let i = 0;
  while (i < all.length && all[i] < value) i++;
  return Math.round((i / all.length) * 100);
}

/* Bách phân vị số TUYẾN buýt trong 800 m — cùng cách đọc với mật độ tiện ích. */
function busPercentile(value) {
  const all = Object.values(state.busNetwork?.buildings || {})
    .map((r) => r?.routes?.['800']?.length ?? r?.routes?.[800]?.length)
    .filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!all.length) return null;
  let i = 0;
  while (i < all.length && all[i] < value) i++;
  return Math.round((i / all.length) * 100);
}

/* Số tuyến xe buýt tới được — biến này thay cho "khoảng cách tới trạm gần
   nhất". Một trạm ngay cửa mà chỉ có một tuyến đi qua thì kém hơn hẳn một
   trạm cách 400 m nhưng có hai mươi tuyến. */
function renderFocusBus(b) {
  const rec = state.busNetwork?.buildings?.[b.id];
  if (!rec) return '';
  const at = (R) => rec.routes?.[String(R)] || rec.routes?.[R] || [];
  const r400 = at(400), r800 = at(800);
  if (!r800.length && !r400.length) {
    return `<div class="fdens fbus">
      <div class="famen__head"><span class="label">Đi lại bằng xe buýt</span></div>
      <p class="famen__note">Không có tuyến xe buýt nào trong 800 m đi bộ.</p>
    </div>`;
  }
  const pct = busPercentile(r800.length);
  const show = r800.slice(0, 14);
  return `<div class="fdens fbus">
    <div class="famen__head">
      <span class="label">Đi lại bằng xe buýt</span>
      <span class="famen__sum">${pct != null ? `nhiều tuyến hơn ${pct}% số tòa` : ''}</span>
    </div>
    <div class="fdens__nums">
      <div class="fdens__n"><span class="fdens__v">${r400.length}</span>
        <span class="fdens__k">tuyến trong 400 m</span></div>
      <div class="fdens__n"><span class="fdens__v">${r800.length}</span>
        <span class="fdens__k">tuyến trong 800 m</span></div>
      <div class="fdens__n"><span class="fdens__v">${rec.nearestStopMin == null ? '—'
    : String(rec.nearestStopMin).replace('.', ',')}</span>
        <span class="fdens__k">phút tới trạm gần nhất</span></div>
    </div>
    <ul class="fbus__refs" aria-label="Số hiệu tuyến xe buýt trong 800 m đi bộ">
      ${show.map((r) => `<li>${esc(r)}</li>`).join('')}
      ${r800.length > show.length ? `<li class="fbus__more">+${r800.length - show.length}</li>` : ''}
    </ul>
    <p class="fdens__plain">Số tuyến xe buýt đi qua các trạm trong bán kính đi bộ. Nguồn: OpenStreetMap.</p>
  </div>`;
}

function renderFocusDensity(b) {
  const rec = state.densityData?.buildings?.[b.id];
  if (!rec) return '';

  if (rec._unreachable) {
    return `<div class="fdens">
      <div class="famen__head"><span class="label">Mật độ tiện ích</span></div>
      <p class="famen__note">${icon('alert', { size: 12 })} Chưa tính được: vị trí này chưa nối
        vào mạng đường đi bộ của OpenStreetMap.</p>
    </div>`;
  }

  const n400 = rec.total[400], n800 = rec.total[800];
  const e = rec.entropy[800];
  const pct = densPercentile(n800, 800);
  const max = Math.max(1, ...DENS_CATS.map(([k]) => rec.counts[800][k] || 0));

  return `<div class="fdens">
    <div class="famen__head">
      <span class="label">Mật độ tiện ích</span>
      <span class="famen__sum">${pct != null ? `nhiều hơn ${pct}% số tòa` : ''}</span>
    </div>

    <div class="fdens__nums">
      <div class="fdens__n"><span class="fdens__v">${n400}</span><span class="fdens__k">trong 400 m đi bộ</span></div>
      <div class="fdens__n"><span class="fdens__v">${n800}</span><span class="fdens__k">trong 800 m đi bộ</span></div>
      <div class="fdens__n"><span class="fdens__v">${e == null ? '—' : String(e.toFixed(2)).replace('.', ',')}</span>
        <span class="fdens__k">độ đa dạng (0–1)</span></div>
    </div>

    <ul class="fdens__bars" aria-label="Số tiện ích theo nhóm trong bán kính 800 m đi bộ">
      ${DENS_CATS.map(([k, label]) => {
    const c = rec.counts[800][k] || 0;
    return `<li>
        <span class="fdens__lab">${esc(label)}</span>
        <span class="fdens__track"><i style="width:${((c / max) * 100).toFixed(1)}%"></i></span>
        <span class="fdens__c">${c}</span>
      </li>`;
  }).join('')}
    </ul>

    <p class="fdens__plain">${densPlain(rec, pct)}</p>
    <details class="rentkey__why fdens__why">
      <summary>Cách tính</summary>
      <p>Số địa điểm đi bộ tới được trong 400 m và 800 m, theo đường thật.</p>
      <p>Độ đa dạng từ 0 (chỉ một loại) đến 1 (tám nhóm đều nhau).</p>
      <p>Tham khảo: Cervero và Kockelman (1997). Chi tiết ở trang Phương pháp.</p>
    </details>
  </div>`;
}

/* Một câu tiếng Việt thường, đặt TRƯỚC mọi thuật ngữ.

   Lời giải thích cũ mở đầu bằng "đếm cơ hội tích luỹ" và "entropy hỗn hợp
   trên 8 nhóm cố định" — đúng về học thuật nhưng người đọc phải giải mã hai
   thuật ngữ trước khi biết con số nói gì. Người dùng phản hồi đúng điều đó.

   Nay: nói KẾT LUẬN trước bằng lời thường, phương pháp gập vào bên dưới cho
   ai cần. Không bỏ chữ nào về phương pháp — chỉ đổi thứ tự đọc. */
function densPlain(rec, pct) {
  const n800 = rec.total[800];
  const e = rec.entropy[800];
  const cats = Object.entries(rec.counts[800] || {}).sort((a, b) => b[1] - a[1]);
  const label = { food: 'ăn uống', banking: 'ngân hàng', transit: 'đi lại',
    convenience: 'mua sắm', health: 'y tế', fitness: 'thể thao',
    hotel: 'khách sạn', parking: 'bãi đỗ xe' };
  const top = cats[0];
  const share = top && n800 ? Math.round((top[1] / n800) * 100) : 0;

  const day = pct == null ? '' : pct >= 75 ? 'Nhiều tiện ích'
    : pct >= 40 ? 'Tiện ích ở mức trung bình' : 'Ít tiện ích';
  const daDang = e == null ? ''
    : e >= 0.8 ? 'Các nhóm khá cân bằng.'
      : e >= 0.6 ? `Nhiều nhất là ${esc(label[top[0]] || top[0])} (${share}%).`
        : `Chủ yếu là ${esc(label[top[0]] || top[0])} (${share}%).`;

  return `${day ? `${day}: ` : ''}${n800} địa điểm trong 800 m đi bộ`
    + `${pct != null ? `, nhiều hơn ${pct}% số tòa` : ''}. ${daDang}`;
}
