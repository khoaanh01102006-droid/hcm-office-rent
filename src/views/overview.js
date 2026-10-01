/* Tổng quan: trang đầu tiên người xem thấy. Mở bằng số liệu thị trường (tổng NLA, giá trung vị,
   lấp đầy bình quân theo diện tích), rồi phân bố theo quận, theo hạng và bảng đầy đủ.
   Chỉ dùng đại lượng có trong dữ liệu; giá giữ theo đơn vị gốc của nguồn. */

import { esc, missingChip } from '../components/primitives.js';
import { isPresent, FieldState } from '../data.js';
import { money, distance, num } from '../format.js';

export function renderOverview(buildings, canXacNhan) {
  const withCoordinate = buildings.filter(hasCoordinate);
  const rents = buildings.filter((b) => isPresent(b.baseRent)).map((b) => b.baseRent.value).sort((a, b) => a - b);
  const medRent = rents.length ? rents[Math.floor(rents.length / 2)] : null;
  const both = buildings.filter((b) => isPresent(b.nla) && isPresent(b.occupancy));
  const nlaSum = buildings.reduce((s, b) => s + (isPresent(b.nla) ? b.nla.value : 0), 0);
  const occW = both.length
    ? both.reduce((s, b) => s + b.occupancy.value * b.nla.value, 0) / both.reduce((s, b) => s + b.nla.value, 0)
    : null;
  const districts = countBy(buildings, (b) => b.districtLabel || 'Chưa xác định');
  const grades = countBy(buildings, (b) => b.grade || 'Chưa xác định')
    .sort((a, b) => a[0].localeCompare(b[0]));

  return `<div class="ov">
    <section class="ov__hero">
      <p class="ov__eyebrow">Property Insight · Văn phòng cho thuê TP.HCM</p>
      <div class="ov__bignum"><span class="ov__num">${buildings.length}</span><span class="ov__unit">tòa nhà văn phòng<br>giá niêm yết tháng 03/2026</span></div>
      <h2 class="ov__thesis">Giá thuê, tỷ lệ lấp đầy và vị trí văn phòng tại TP.HCM</h2>
      <p class="ov__lede">Xem trên bản đồ, lọc theo khu vực, hạng và giá; mở từng tòa để xem tiện ích và thời gian đi lại xung quanh.</p>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">${esc(num(nlaSum / 1e6, 2, 2))}</span><span class="k">triệu m² diện tích cho thuê (NLA)</span></div>
        <div class="ov__stat"><span class="v">${medRent == null ? '—' : esc(money(medRent))}</span><span class="k">USD/m²/tháng, giá niêm yết trung vị (gồm phí dịch vụ)</span></div>
        <div class="ov__stat"><span class="v">${occW == null ? '—' : esc(num(occW, 1, 1)) + '%'}</span><span class="k">tỷ lệ lấp đầy bình quân theo diện tích</span></div>
        <div class="ov__stat"><span class="v">${withCoordinate.length}</span><span class="k">tòa có vị trí trên bản đồ</span></div>
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">01 · Khu vực</p><h3>Số tòa nhà theo quận</h3><p class="ov__lede">Quận theo ranh giới trước 07/2025.</p></div>
      <div class="ovgrid" role="list" aria-label="Số tòa nhà theo quận">
        ${districts.map(([label, count]) => tile(label, `${count} tòa`)).join('')}
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">02 · Hạng</p><h3>Số tòa nhà theo hạng</h3><p class="ov__lede">Hạng theo nguồn dữ liệu.</p></div>
      <div class="ovgrid" role="list" aria-label="Số tòa nhà theo hạng">
        ${grades.map(([label, count]) => tile(`Hạng ${label}`, `${count} tòa · ${Math.round((count / buildings.length) * 100)}%`)).join('')}
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">03 · Danh sách</p><h3>${buildings.length} tòa nhà</h3><p class="ov__lede">Chọn một tòa trên bản đồ hoặc ở tab Danh sách để xem chi tiết.</p></div>
      <div class="tablewrap" tabindex="0" aria-label="Bảng ${buildings.length} tòa nhà">
        <table class="ovtable">
          <caption class="sr-only">Danh sách ${buildings.length} tòa nhà: tên, quận, hạng, giá thuê 03/2026, tỷ lệ lấp đầy, diện tích cho thuê, khoảng cách tới ga metro và tọa độ.</caption>
          <thead><tr><th scope="col">Tòa nhà</th><th scope="col">Quận</th><th scope="col">Hạng</th><th scope="col" class="n">Giá thuê 03/2026</th><th scope="col" class="n">Lấp đầy</th><th scope="col" class="n">NLA</th><th scope="col" class="n">Cách metro</th><th scope="col">Tọa độ</th></tr></thead>
          <tbody>${buildings.map(tableRow).join('')}</tbody>
        </table>
      </div>
      <p class="ov__note">Giá niêm yết USD/m²/tháng, gồm phí dịch vụ, chưa VAT. Khoảng cách tới metro đo theo đường thẳng.</p>
    </section>

    ${canXacNhanBand(canXacNhan, buildings)}

    <section class="ov__band ov__band--notes">
      <div class="ov__head"><p class="ov__sectag">05 · Lưu ý</p><h3>Khi đọc số liệu</h3></div>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">01</span><span class="k">Giá là giá niêm yết, gồm phí dịch vụ, chưa VAT; không phải giá ký hợp đồng.</span></div>
        <div class="ov__stat"><span class="v">02</span><span class="k">Khoảng cách tới metro, trung tâm và sân bay đo theo đường thẳng; thời gian đi bộ đo theo đường thật.</span></div>
        <div class="ov__stat"><span class="v">03</span><span class="k">Thời gian lái xe có xét giao thông là một lần đo lúc 08:04 ngày 29/08/2026.</span></div>
      </div>
      ${luuYBlock(canXacNhan)}
    </section>
  </div>`;
}

/* Lưu ý (01/10): tòa có trang rao cùng số nhà nhưng mang tên khác. Đã tra web từng cặp; ghi rõ cặp nào đã ghép giá.
   Dữ liệu: atlas/06_PHAN_TICH/kich_ban/n34_can_thay_xac_nhan.py (LUU_Y). */
function luuYBlock(d) {
  const ds = d?.luu_y || [];
  if (!ds.length) return '';
  return `<div class="ovly" id="luu-y-ten-khac">
        <h4 class="ovly__tieude">Tòa mang tên khác trên trang rao</h4>
        <p class="ovly__mo">Cùng số nhà nhưng trang rao dùng tên khác. Cặp nào web và giá cùng xác nhận là một tòa thì đã lấy giá trang rao.</p>
        <table class="ovly__bang">
          <thead><tr><th scope="col">STT</th><th scope="col">Tên trong bộ dữ liệu</th><th scope="col">Tên trên trang rao</th>
            <th scope="col">Địa chỉ</th><th scope="col">Ghi chú</th></tr></thead>
          <tbody>${ds.map((x) => `<tr>
            <td>${esc(x.stt)}</td><td>${esc(x.ten)}</td><td>${esc(x.ten_trang)}</td><td>${esc(x.dia_chi)}</td>
            <td><span class="ovly__nhan ovly__nhan--${x.da_ghep ? 'co' : 'chua'}">${x.da_ghep ? 'Đã ghép' : 'Chưa ghép'}</span> ${esc(x.ghi_chu)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
}

/* Cần thầy xác nhận (01/10): chỉ những ca đã thử đủ cách mà vẫn còn hai khả năng, hoặc lỗi nằm ở chính bộ dữ liệu.
   Dữ liệu: atlas/06_PHAN_TICH/kich_ban/n34_can_thay_xac_nhan.py. */
const MUC = { cao: 'Ưu tiên', trung_binh: 'Nên xem', thap: 'Xem khi rảnh' };
function canXacNhanBand(d, buildings) {
  const ds = d?.ca || [];
  if (!ds.length) return '';
  const ten = new Map(buildings.map((b) => [String(b.teacherNo), b.name]));
  return `<section class="ov__band" id="can-xac-nhan">
      <div class="ov__head"><p class="ov__sectag">04 · Cần xác nhận</p><h3>${ds.length} trường hợp cần thầy xác nhận</h3>
        <p class="ov__lede">Đã đối chiếu với trang rao, Google và tìm trên web nhưng vẫn còn hai khả năng, hoặc dữ liệu có thể bị
        nhập trùng. Các tòa còn lại đã được kiểm và sửa.</p></div>
      <ol class="ovxn">${ds.map((c) => `<li class="ovxn__ca ovxn__ca--${esc(c.muc)}">
        <div class="ovxn__dau"><span class="ovxn__muc">${esc(MUC[c.muc] || c.muc)}</span>
          <strong>${esc(c.tieu_de)}</strong><small>STT ${c.stt.map((s) => esc(s)).join(', ')}${c.stt.length ? ` · ${c.stt.map((s) => esc(ten.get(s) || '')).filter(Boolean).join(' / ')}` : ''}</small></div>
        <p>${esc(c.van_de)}</p>
        <p class="ovxn__so">${esc(c.so_lieu)}</p>
        <p class="ovxn__da">Đã làm: ${esc(c.da_lam)}</p>
        <p class="ovxn__hoi">${esc(c.cau_hoi)}</p>
      </li>`).join('')}</ol>
    </section>`;
}

function tile(label, value) {
  return `<div class="ovtile" role="listitem" style="background:var(--r0);color:var(--on-r0)"><span class="ovtile__n">${esc(label)}</span><span class="ovtile__v">${esc(value)}</span></div>`;
}

function hasCoordinate(b) {
  // Number(null) là 0, nên phải loại null trước: bản trước đếm cả 7 tòa chưa có tọa độ.
  return b.lat != null && b.lng != null && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng));
}

function countBy(buildings, key) {
  const counts = new Map();
  for (const b of buildings) counts.set(key(b), (counts.get(key(b)) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'));
}

function tableRow(b) {
  return `<tr>
    <th scope="row">${esc(b.name)}${b.nameOriginal && b.nameOriginal !== b.name ? `<br><small class="dim">Tên khác: ${esc(b.nameOriginal)}</small>` : ''}</th>
    <td class="dim">${esc(b.districtLabel || '—')}</td>
    <td><span class="gpill">${esc(b.gradeLabel || '—')}</span></td>
    <td class="n">${isPresent(b.baseRent) ? esc(money(b.baseRent.value)) : missingChip(b.baseRent.state)}</td>
    <td class="n">${isPresent(b.occupancy) ? `${esc(num(b.occupancy.value, 1, 1))}%` : missingChip(b.occupancy.state)}</td>
    <td class="n">${isPresent(b.nla) ? `${esc(num(b.nla.value))} m²` : missingChip(b.nla.state)}</td>
    <td class="n">${isPresent(b.distanceMetro) ? esc(distance(b.distanceMetro.value)) : missingChip(b.distanceMetro.state)}</td>
    <td>${hasCoordinate(b) ? '<span class="badge badge--ok">Có</span>' : missingChip(FieldState.NOT_COLLECTED, 'Chưa đủ căn cứ để đặt vị trí.', 'Chưa có')}</td>
  </tr>`;
}
