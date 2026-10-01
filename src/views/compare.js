/* =========================================================================
   So sánh 2–4 tòa nhà

   - Không có ô "tốt nhất": chưa có phương pháp chấm điểm, nên bảng không tự
     tuyên bố tòa nào hơn.
   - Biến khác định nghĩa chia theo nhóm có tiêu đề, mỗi hàng có đơn vị riêng.
   - Thiếu dữ liệu hiện rõ. Nhóm nào thiếu ở MỌI tòa trong bộ dữ liệu thì bỏ
     hẳn (thông số tòa nhà và tiện ích Google: 0/407 tòa, đo 30/09/2026), vì
     một bảng toàn ô "chưa thu thập" không so sánh được gì.
   - Chỉ làm nổi tiêu chí do chính người dùng chọn.
   ========================================================================= */

import { icon } from '../icons.js';
import { isPresent } from '../data.js';
import { money, distance, num } from '../format.js';
import { esc, missingChip, gradeBadge } from '../components/primitives.js';
import { COORD_METHOD } from './profile.js';

const ROWS = [
  {
    group: 'Thông tin cho thuê 03/2026',
    note: 'Giá niêm yết, gồm phí dịch vụ, chưa VAT.',
    items: [
      { key: 'baseRent', label: 'Giá thuê', unit: 'USD/m²/tháng', def: 'Giá niêm yết tháng 03/2026, gồm phí dịch vụ', get: (b) => b.baseRent, fmt: money, strong: true },
      { key: 'occupancy', label: 'Tỷ lệ lấp đầy', unit: '%', def: 'Tháng 03/2026', get: (b) => b.occupancy, fmt: (v) => num(v, 1, 1) },
      { key: 'nla', label: 'Diện tích cho thuê', unit: 'm²', def: 'NLA', get: (b) => b.nla, fmt: num },
    ],
  },
  {
    group: 'Vị trí',
    note: 'Ba dòng đầu đo theo đường thẳng, dòng cuối theo đường đi bộ.',
    items: [
      { key: 'distanceMetro', label: 'Cách ga metro gần nhất', unit: 'đường thẳng', def: 'Tên ga ghi dưới con số', get: (b) => b.distanceMetro, fmt: distance, sub: (b) => `ga ${b.nearestMetro}` },
      { key: 'distanceCbd', label: 'Cách trung tâm', unit: 'đường thẳng', def: 'Tới UBND Thành phố', get: (b) => b.distanceCbd, fmt: distance },
      { key: 'distanceAirport', label: 'Cách sân bay', unit: 'đường thẳng', def: 'Tới sân bay Tân Sơn Nhất', get: (b) => b.distanceAirport, fmt: distance },
      { key: 'metroWalkingDistance', label: 'Đi bộ tới ga metro', unit: 'đường đi', def: 'Google Routes', get: (b) => b.metroWalkingDistance, fmt: distance },
    ],
  },
];

export function renderCompare(items, data, extra = {}) {
  return `
  <div class="cmp">
    <p class="cmp__lead">
      ${icon('info', { size: 14 })}
      Đặt cạnh nhau tối đa 4 tòa. Bảng không chấm điểm hay xếp hạng.
    </p>

    ${priorityPicker()}
    ${headerCards(items)}
    ${tables(items)}
    ${surroundSection(items, extra)}
    ${coordSection(items)}
  </div>`;
}

/* Tiêu chí do người dùng chọn: cách duy nhất được phép làm nổi một hàng. */
function priorityPicker() {
  const all = ROWS.flatMap((g) => g.items).filter((i) => ['baseRent', 'occupancy', 'nla', 'distanceMetro', 'metroWalkingDistance', 'distanceCbd'].includes(i.key));
  return `<section class="cmp__prio">
    <h4>Tiêu chí quan tâm</h4>
    <p>Chọn tối đa ba tiêu chí để đánh dấu trong bảng.</p>
    <div class="chipset" id="cmp-prio">
      ${all.map((i) => `<button class="togglechip" type="button" data-prio="${esc(i.key)}" aria-pressed="false">${esc(i.label)}</button>`).join('')}
    </div>
  </section>`;
}

function headerCards(items) {
  return `<div class="cmp__heads" style="--cols:${items.length}">
    <div class="cmp__corner"></div>
    ${items.map((b) => `<div class="cmphead">
      ${b.image ? `<img src="${esc(b.image.localUrl)}" alt="" width="44" height="44" loading="lazy">` : '<span class="cmphead__noimg" aria-hidden="true"></span>'}
      <div class="cmphead__id">
        <h4>${esc(b.name)}</h4>
        <p>${esc(b.districtLabel)} · ${gradeBadge(b, { withNote: false })}</p>
      </div>
      <button class="btn" type="button" data-act="profile" data-id="${esc(b.id)}">Chi tiết</button>
    </div>`).join('')}
  </div>`;
}

function valueCell(b, it) {
  return (max) => {
    const f = it.get(b);
    const v = isPresent(f) ? f.value : null;
    const pct = max && typeof v === 'number' && v > 0 ? (v / max) * 100 : null;
    return `<td data-col="${esc(b.name)}" class="${it.strong ? 'is-strong' : ''}">
      ${isPresent(f) ? `<span class="cmp__val">${esc(it.fmt(f.value))}</span>` : missingChip(f.state)}
      ${it.sub && isPresent(f) ? `<span class="cmp__sub">${esc(it.sub(b))}</span>` : ''}
      ${pct != null ? `<span class="cmp__bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}
    </td>`;
  };
}

function groupTable(title, note, items, rows) {
  return `<section class="cmp__group">
    <div class="cmp__grouphead">
      <h4>${esc(title)}</h4>
      ${note ? `<p>${icon('info', { size: 12 })} ${esc(note)}</p>` : ''}
    </div>
    <table class="cmp__table" style="--cols:${items.length}">
      <caption class="sr-only">${esc(title)}: so sánh ${items.length} tòa nhà.</caption>
      <thead>
        <tr>
          <th scope="col">Chỉ tiêu</th>
          ${items.map((b) => `<th scope="col">${esc(b.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((it) => {
          // Mốc của thanh là giá trị lớn nhất TRONG CHÍNH HÀNG NÀY; mốc chung cho cả bảng là so mét với phần trăm.
          const vals = items.map((b) => it.get(b)).filter(isPresent).map((f) => f.value)
            .filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
          const max = !it.noBar && vals.length > 1 ? Math.max(...vals) : 0;
          return `<tr data-row="${esc(it.key)}">
          <th scope="row">
            <span class="cmp__label">${esc(it.label)}</span>
            ${it.unit ? `<span class="cmp__unit">${esc(it.unit)}</span>` : ''}
            ${it.def ? `<span class="cmp__def" title="${esc(it.def)}">${icon('info', { size: 11 })}<span class="sr-only">${esc(it.def)}</span></span>` : ''}
          </th>
          ${items.map((b) => valueCell(b, it)(max)).join('')}
        </tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>`;
}

function tables(items) {
  return ROWS.map((g) => groupTable(g.group, g.note, items, g.items)).join('');
}

/* Khu vực xung quanh: lớp OpenStreetMap đã phủ 400/407 tòa (mật độ tiện ích, tuyến xe buýt, lái xe). */
function surroundSection(items, { density, bus, driving } = {}) {
  const field = (v) => (v == null ? { state: 'not_collected', value: null } : { state: 'present', value: v });
  const dens = (b) => density?.buildings?.[b.id];
  const routes = (b) => {
    const r = bus?.buildings?.[b.id];
    const list = r && (r.routes?.['800'] || r.routes?.[800]);
    return list ? list.length : null;
  };
  const drive = (b, k) => driving?.buildings?.[b.id]?.[k];
  const range = (t) => (t?.minMinutes ? `${t.minMinutes}–${t.maxMinutes}` : null);
  const rows = [
    { key: 'dens400', label: 'Tiện ích trong 400 m', unit: 'địa điểm', def: 'Đi bộ theo đường thật', get: (b) => field(dens(b)?.total?.[400]), fmt: num },
    { key: 'dens800', label: 'Tiện ích trong 800 m', unit: 'địa điểm', def: 'Đi bộ theo đường thật', get: (b) => field(dens(b)?.total?.[800]), fmt: num },
    { key: 'mix', label: 'Độ đa dạng tiện ích', unit: '0–1', def: '0 là một loại, 1 là tám nhóm đều nhau', get: (b) => field(dens(b)?.entropy?.[800]), fmt: (v) => num(v, 2, 2), noBar: true },
    { key: 'bus800', label: 'Tuyến xe buýt trong 800 m', unit: 'tuyến', def: 'Nguồn: OpenStreetMap', get: (b) => field(routes(b)), fmt: num },
    { key: 'driveCbd', label: 'Lái xe tới trung tâm', unit: 'phút', def: 'Từ giờ thường đến giờ cao điểm', get: (b) => field(range(drive(b, 'cbd'))), fmt: String, noBar: true },
    { key: 'driveAir', label: 'Lái xe tới sân bay', unit: 'phút', def: 'Từ giờ thường đến giờ cao điểm', get: (b) => field(range(drive(b, 'airport'))), fmt: String, noBar: true },
  ];
  if (!items.some((b) => rows.some((r) => isPresent(r.get(b))))) return '';
  return groupTable('Khu vực xung quanh', 'Nguồn: OpenStreetMap.', items, rows);
}

function coordSection(items) {
  const rows = [
    { key: 'coord', label: 'Cách xác định tọa độ', get: (b) => ({ state: 'present', value: COORD_METHOD[b.coordinateStatus] || 'Theo nguồn dữ liệu' }), fmt: String, noBar: true },
    { key: 'srcn', label: 'Số nguồn đối chiếu', get: (b) => ({ state: 'present', value: b.identitySourceDomains.length }), fmt: num, noBar: true },
  ];
  return groupTable('Tọa độ', '', items, rows);
}
