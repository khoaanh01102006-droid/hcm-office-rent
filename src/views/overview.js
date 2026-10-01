/* Tổng quan: trang đầu tiên người xem thấy. Mở bằng số liệu thị trường (tổng NLA, giá trung vị,
   lấp đầy bình quân theo diện tích), rồi biểu đồ, phân bố theo quận, theo hạng và bảng đầy đủ.
   Chỉ dùng đại lượng có trong dữ liệu; giá giữ theo đơn vị gốc của nguồn.

   01/10 (chủ dự án; thầy sẽ đọc kỹ): bấm ô quận hoặc ô hạng thì bảng 04 lọc theo ô đó; thêm ba biểu đồ vẽ từ chính dữ liệu;
   mục "Cần xác nhận" và "Tòa mang tên khác" chuyển sang tab Lưu ý; ghi rõ hai trường chưa có định nghĩa từ nguồn
   (lấp đầy, hạng) và phạm vi số đo giao thông. */

import { esc, missingChip } from '../components/primitives.js';
import { isPresent, FieldState } from '../data.js';
import { money, distance, num } from '../format.js';
import { DAY_DU, NHAN } from '../che_do.js';

/* loc: { kieu: 'quan' | 'hang', giaTri } — lọc bảng danh sách khi bấm ô. */
export function renderOverview(buildings, canXacNhan, loc = null) {
  const withCoordinate = buildings.filter(hasCoordinate);
  const rents = buildings.filter((b) => isPresent(b.baseRent)).map((b) => b.baseRent.value).sort((a, b) => a - b);
  const medRent = rents.length ? median(rents) : null;
  const both = buildings.filter((b) => isPresent(b.nla) && isPresent(b.occupancy));
  const nlaSum = buildings.reduce((s, b) => s + (isPresent(b.nla) ? b.nla.value : 0), 0);
  const occW = both.length
    ? both.reduce((s, b) => s + b.occupancy.value * b.nla.value, 0) / both.reduce((s, b) => s + b.nla.value, 0)
    : null;
  const quanCua = (b) => b.districtLabel || 'Chưa xác định';
  const hangCua = (b) => b.grade || 'Chưa xác định';
  const districts = countBy(buildings, quanCua);
  const grades = countBy(buildings, hangCua).sort((a, b) => a[0].localeCompare(b[0]));
  const coGiaoThong = buildings.filter((b) => b.trafficObservationDate && (b.traffic || []).length).length;
  const so407 = buildings.filter((b) => b.laToa407).length;
  const soNla = buildings.filter((b) => isPresent(b.nla)).length;
  const nhanHang = (h) => (h.length === 1 ? `Hạng ${h}` : h);   // hạng chữ cái; 'Giá rẻ', 'Nguyên căn' (trang rao) giữ nguyên
  const soCa = canXacNhan?.ca?.length || 0;

  const loai = loc ? buildings.filter((b) => (loc.kieu === 'quan' ? quanCua(b) : hangCua(b)) === loc.giaTri) : buildings;
  const tenLoc = loc ? (loc.kieu === 'quan' ? loc.giaTri : (loc.giaTri.length === 1 ? `Hạng ${loc.giaTri}` : loc.giaTri)) : '';

  return `<div class="ov">
    <section class="ov__hero">
      <p class="ov__eyebrow">Property Insight · ${DAY_DU ? 'Phiên bản đầy đủ' : 'Văn phòng cho thuê TP.HCM'}</p>
      <div class="ov__bignum"><span class="ov__num">${esc(buildings.length.toLocaleString('vi-VN'))}</span><span class="ov__unit">tòa nhà văn phòng<br>${DAY_DU
    ? `${so407} tòa của bộ dữ liệu, ${(buildings.length - so407).toLocaleString('vi-VN')} tòa trên trang rao` : 'giá niêm yết tháng 03/2026'}</span></div>
      <h2 class="ov__thesis">Giá thuê, tỷ lệ lấp đầy và vị trí văn phòng tại TP.HCM</h2>
      <p class="ov__lede">Xem trên bản đồ, lọc theo khu vực, hạng và giá; mở từng tòa để xem tiện ích và thời gian đi lại xung quanh.
        Giá: ${esc(NHAN.giaDai)}, đơn vị USD/m²/tháng.${DAY_DU ? ' Mọi tòa dùng cùng một loại giá; giá niêm yết 03/2026 của 407 tòa xem trong hồ sơ từng tòa.' : ''}</p>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">${esc(num(nlaSum / 1e6, 2, 2))}</span><span class="k">triệu m² diện tích cho thuê (NLA), cộng của ${soNla} tòa có số liệu${DAY_DU ? ' (chỉ bộ 407 tòa có NLA)' : ''}</span></div>
        <div class="ov__stat"><span class="v">${medRent == null ? '—' : esc(money(medRent))}</span><span class="k">USD/m²/tháng, ${esc(NHAN.giaNgan)} trung vị của ${rents.length.toLocaleString('vi-VN')} tòa có giá (${esc(NHAN.giaCoSo)})</span></div>
        <div class="ov__stat"><span class="v">${occW == null ? '—' : esc(num(occW, 1, 1)) + '%'}</span><span class="k">tỷ lệ lấp đầy bình quân, gia quyền theo diện tích cho thuê${DAY_DU ? ' (chỉ bộ 407 tòa)' : ''}</span></div>
        <div class="ov__stat"><span class="v">${esc(withCoordinate.length.toLocaleString('vi-VN'))}</span><span class="k">tòa có vị trí trên bản đồ (${buildings.length - withCoordinate.length} tòa chưa có, xem tab Lưu ý)</span></div>
      </div>
      ${soCa ? `<p class="ov__note">Có ${soCa} trường hợp dữ liệu đang chờ thầy xác nhận; xem tab <strong>Lưu ý</strong>.</p>` : ''}
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">01 · Biểu đồ</p><h3>Giá và diện tích nhìn tổng thể</h3>
        <p class="ov__lede">Vẽ trực tiếp từ ${buildings.length} tòa${DAY_DU ? ' của phiên bản đầy đủ' : ' của bộ dữ liệu'}. ${esc(NHAN.giaTieuDe)}, USD/m²/tháng, ${esc(NHAN.giaCoSo)}.</p></div>
      <div class="ovchart-grid">
        ${bieuDoPhanBoGia(rents, medRent)}
        ${bieuDoGiaTheoHang(buildings)}
        ${bieuDoNlaTheoQuan(buildings, quanCua)}
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">02 · Khu vực</p><h3>Số tòa nhà theo quận</h3>
        <p class="ov__lede">Quận ghi trong bộ dữ liệu, theo ranh giới trước 07/2025. Bấm một ô để xem danh sách tòa của quận đó ở mục 04.</p></div>
      <div class="ovgrid" role="list" aria-label="Số tòa nhà theo quận">
        ${districts.map(([label, count]) => tile(label, `${count} tòa`, 'quan', label, loc)).join('')}
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">03 · Hạng</p><h3>Số tòa nhà theo hạng</h3>
        <p class="ov__lede">${DAY_DU ? 'Hạng của 407 tòa lấy từ bộ dữ liệu, của tòa khác lấy từ trang rao; cả hai nguồn đều chưa công bố tiêu chí phân hạng.' : 'Hạng ghi trong bộ dữ liệu; nguồn chưa công bố tiêu chí phân hạng.'} Bấm một ô để xem danh sách tòa của hạng đó.</p></div>
      <div class="ovgrid" role="list" aria-label="Số tòa nhà theo hạng">
        ${grades.map(([label, count]) => tile(nhanHang(label), `${count} tòa · ${Math.round((count / buildings.length) * 100)}%`, 'hang', label, loc)).join('')}
      </div>
    </section>

    <section class="ov__band" id="ov-danh-sach">
      <div class="ov__head"><p class="ov__sectag">04 · Danh sách</p>
        <h3>${loc ? `${esc(tenLoc)} · ${loai.length} tòa` : `${buildings.length} tòa nhà`}</h3>
        <p class="ov__lede">${loc
    ? `Đang lọc theo ô đã bấm. <button class="btn btn--sm" type="button" data-ovclear>Xem lại cả ${buildings.length} tòa</button>`
    : 'Bấm một ô quận hoặc hạng ở trên để lọc bảng; chọn một tòa trên bản đồ hoặc ở tab Danh sách để xem chi tiết.'}</p></div>
      <div class="tablewrap" tabindex="0" aria-label="Bảng ${loai.length} tòa nhà">
        <table class="ovtable">
          <caption class="sr-only">Danh sách ${loai.length} tòa nhà${loc ? ` thuộc ${esc(tenLoc)}` : ''}: tên, quận, hạng, ${esc(NHAN.giaNgan)}, tỷ lệ lấp đầy, diện tích cho thuê, khoảng cách tới ga metro và tọa độ.</caption>
          <thead><tr><th scope="col">Tòa nhà</th><th scope="col">Quận</th><th scope="col">Hạng</th><th scope="col" class="n">${esc(NHAN.giaTieuDe)}</th><th scope="col" class="n">Lấp đầy</th><th scope="col" class="n">NLA</th><th scope="col" class="n">Cách metro</th><th scope="col">Tọa độ</th></tr></thead>
          <tbody>${loai.map(tableRow).join('')}</tbody>
        </table>
      </div>
      <p class="ov__note">${esc(NHAN.giaDai)}, USD/m²/tháng. Khoảng cách tới metro đo theo đường thẳng.${DAY_DU ? ' Tòa ngoài bộ 407 chưa có số đo khoảng cách, NLA và lấp đầy.' : ''}</p>
    </section>

    <section class="ov__band ov__band--notes">
      <div class="ov__head"><p class="ov__sectag">05 · Lưu ý</p><h3>Khi đọc số liệu</h3></div>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">01</span><span class="k">${esc(NHAN.giaDai)}; không phải giá ký hợp đồng.${DAY_DU ? ' Giá chào và giá niêm yết 03/2026 khác cơ sở (giá niêm yết gồm phí dịch vụ), nên không so trực tiếp.' : ''}</span></div>
        <div class="ov__stat"><span class="v">02</span><span class="k">Tỷ lệ lấp đầy và hạng lấy nguyên từ bộ dữ liệu; nguồn chưa ghi lấp đầy là diện tích đang sử dụng hay đã ký thuê, cũng chưa ghi tiêu chí phân hạng.</span></div>
        <div class="ov__stat"><span class="v">03</span><span class="k">Khoảng cách tới metro, trung tâm và sân bay đo theo đường thẳng; thời gian đi bộ đo theo đường thật trên bản đồ OpenStreetMap.</span></div>
        <div class="ov__stat"><span class="v">04</span><span class="k">Thời gian lái xe có xét giao thông là một lần đo lúc 08:04 ngày 29/08/2026, có ở ${coGiaoThong}/${so407} tòa của bộ dữ liệu; các tòa sửa vị trí ngày 01/10/2026 chưa đo lại.</span></div>
        ${DAY_DU ? `<div class="ov__stat"><span class="v">05</span><span class="k">${buildings.length - so407} tòa ngoài bộ 407 lấy từ trang rao: vị trí là ghim Google Maps (chỉ hiện trên nền Google, phải lấy lại trước 30 ngày), chưa có NLA, lấp đầy và số đo quanh tòa. Kho trang rao giữ nguyên như đã thu, nên có lẫn vài tin không phải tòa văn phòng thông thường (nhà xưởng trong khu công nghiệp, biệt thự, cho thuê nguyên căn).</span></div>` : ''}
      </div>
    </section>
  </div>`;
}

/* ---- Biểu đồ: thanh HTML/CSS, không thư viện, có aria-label tóm tắt ---- */

function bieuDoPhanBoGia(rents, med) {
  if (!rents.length) return '';
  const buoc = 5;
  const tran = 60;                                 // >= 60 gộp một cột (giá lệch phải: vài tòa hạng A tới ~70)
  const cot = [];
  for (let a = 0; a < tran; a += buoc) cot.push({ nhan: `${a}–${a + buoc}`, moc: String(a), n: rents.filter((v) => v >= a && v < a + buoc).length });
  cot.push({ nhan: `≥ ${tran}`, moc: `≥${tran}`, n: rents.filter((v) => v >= tran).length });
  const lon = Math.max(...cot.map((c) => c.n));
  const cotMed = Math.min(cot.length - 1, Math.floor(med / buoc));
  return `<figure class="ovchart">
    <figcaption><strong>Phân bố ${esc(NHAN.giaNgan)}</strong><span>Số tòa theo khoảng giá 5 USD/m²/tháng; cột viền đậm chứa giá trung vị ${esc(money(med))}.</span></figcaption>
    <div class="ovchart__cols" role="img" aria-label="${esc(cot.map((c) => `${c.nhan}: ${c.n} tòa`).join('; '))}">
      ${cot.map((c, i) => `<div class="ovchart__col${i === cotMed ? ' is-med' : ''}" title="${esc(c.nhan)} USD: ${c.n} tòa">
        <span class="ovchart__n">${c.n || ''}</span><span class="ovchart__bar" style="height:${lon ? (100 * c.n / lon).toFixed(1) : 0}%"></span>
        <span class="ovchart__x">${esc(c.moc)}</span></div>`).join('')}
    </div>
    <p class="ovchart__truc">Mốc dưới của mỗi khoảng, USD/m²/tháng (ví dụ cột 20 là từ 20 đến dưới 25).</p>
  </figure>`;
}

function bieuDoGiaTheoHang(buildings) {
  const theoHang = {};
  for (const b of buildings) if (isPresent(b.baseRent) && b.grade) (theoHang[b.grade] ||= []).push(b.baseRent.value);
  const hang = Object.keys(theoHang).sort();
  if (!hang.length) return '';
  const tatCa = hang.flatMap((h) => theoHang[h]);
  const lo = 0;
  const hi = Math.ceil(Math.max(...tatCa) / 10) * 10;
  const x = (v) => (100 * (v - lo) / (hi - lo)).toFixed(1);
  const dong = hang.map((h) => {
    const v = theoHang[h].slice().sort((a, b) => a - b);
    const q1 = phanVi(v, 0.25), q3 = phanVi(v, 0.75), md = median(v);
    return `<div class="ovbox__dong" title="${esc(h.length === 1 ? `Hạng ${h}` : h)}: ${v.length} tòa; thấp nhất ${esc(money(v[0]))}, 25% ${esc(money(q1))}, trung vị ${esc(money(md))}, 75% ${esc(money(q3))}, cao nhất ${esc(money(v[v.length - 1]))}">
      <span class="ovbox__nhan">${esc(h.length === 1 ? `Hạng ${h}` : h)}<small>${v.length} tòa</small></span>
      <span class="ovbox__truc">
        <span class="ovbox__ria" style="left:${x(v[0])}%;width:${(x(v[v.length - 1]) - x(v[0])).toFixed(1)}%"></span>
        <span class="ovbox__hop" style="left:${x(q1)}%;width:${Math.max(0.6, x(q3) - x(q1)).toFixed(1)}%"></span>
        <span class="ovbox__md" style="left:${x(md)}%"></span>
      </span>
      <span class="ovbox__so">${esc(money(md))}</span></div>`;
  }).join('');
  return `<figure class="ovchart">
    <figcaption><strong>${esc(NHAN.giaTieuDe)} theo hạng</strong><span>Vạch đậm là trung vị (số bên phải); hộp là khoảng giữa 50% số tòa; đường mảnh là thấp nhất đến cao nhất. Trục từ ${lo} đến ${hi} USD/m²/tháng.</span></figcaption>
    <div class="ovbox" role="img" aria-label="${esc(NHAN.giaTieuDe)} trung vị theo hạng: ${esc(hang.map((h) => `${h.length === 1 ? `Hạng ${h}` : h} ${money(median(theoHang[h].slice().sort((a, b) => a - b)))}`).join('; '))}">${dong}</div>
  </figure>`;
}

function bieuDoNlaTheoQuan(buildings, quanCua) {
  const tong = {};
  for (const b of buildings) if (isPresent(b.nla)) tong[quanCua(b)] = (tong[quanCua(b)] || 0) + b.nla.value;
  const ds = Object.entries(tong).sort((a, b) => b[1] - a[1]);
  const top = ds.slice(0, 8);
  const conLai = ds.slice(8).reduce((s, [, v]) => s + v, 0);
  if (conLai > 0) top.push([`${ds.length - 8} quận còn lại`, conLai]);
  const tongAll = ds.reduce((s, [, v]) => s + v, 0);
  const lon = Math.max(...top.map(([, v]) => v));
  return `<figure class="ovchart">
    <figcaption><strong>Diện tích cho thuê theo quận</strong><span>Tổng NLA của các tòa ${DAY_DU ? 'thuộc bộ 407 tòa (tòa trang rao không có NLA)' : 'trong bộ dữ liệu'}, nghìn m²; phần trăm là tỷ trọng trong ${esc(num(tongAll / 1e6, 2, 2))} triệu m².</span></figcaption>
    <div class="ovbars" role="img" aria-label="${esc(top.map(([q, v]) => `${q}: ${Math.round(v / 1000)} nghìn m²`).join('; '))}">
      ${top.map(([q, v]) => `<div class="ovbars__dong"><span class="ovbars__nhan">${esc(q)}</span>
        <span class="ovbars__truc"><span class="ovbars__thanh" style="width:${(100 * v / lon).toFixed(1)}%"></span></span>
        <span class="ovbars__so">${esc(num(v / 1000, 0, 0))} · ${Math.round(100 * v / tongAll)}%</span></div>`).join('')}
    </div>
  </figure>`;
}

function median(v) {
  const s = v.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function phanVi(s, t) {                 // s đã sắp tăng; nội suy tuyến tính
  const i = (s.length - 1) * t, a = Math.floor(i), b = Math.ceil(i);
  return s[a] + (s[b] - s[a]) * (i - a);
}

function tile(label, value, kieu, giaTri, loc) {
  const dang = loc && loc.kieu === kieu && loc.giaTri === giaTri;
  return `<button type="button" class="ovtile ovtile--nut${dang ? ' is-on' : ''}" role="listitem" data-ovloc="${esc(kieu)}" data-ovval="${esc(giaTri)}"
    aria-pressed="${dang ? 'true' : 'false'}" style="background:var(--r0);color:var(--on-r0)"
    title="Bấm để xem danh sách tòa: ${esc(label)}"><span class="ovtile__n">${esc(label)}</span><span class="ovtile__v">${esc(value)}</span></button>`;
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
