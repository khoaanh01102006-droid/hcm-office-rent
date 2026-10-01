/* LƯU Ý — tab riêng (01/10, chủ dự án: "tách mục lưu ý thành một mục như tổng quan và biến động"; thầy sẽ đọc kỹ).
   Ba phần, đều đọc từ dữ liệu, không ghi cứng số:
     01 · Cần thầy xác nhận: ca đã thử đủ cách (trang rao, Google, tra web) mà vẫn còn hai khả năng, hoặc lỗi ở chính bộ dữ liệu.
     02 · Tòa mang tên khác trên trang rao: cùng số nhà, khác tên; ghi rõ cặp nào đã ghép giá.
     03 · Tòa chưa có vị trí trên bản đồ: đã xác định tòa và địa chỉ nhưng chưa có tọa độ đủ tin cậy.
   Dữ liệu 01 và 02: atlas/06_PHAN_TICH/kich_ban/n34_can_thay_xac_nhan.py -> data/can_xac_nhan.json. */

import { esc } from '../components/primitives.js';

const MUC = { cao: 'Ưu tiên', trung_binh: 'Nên xem', thap: 'Xem khi rảnh' };

export function renderNotes(d, buildings) {
  const ca = d?.ca || [];
  const ly = d?.luu_y || [];
  const ten = new Map(buildings.map((b) => [String(b.teacherNo), b.nameOriginal || b.name]));   // tên trong file thầy, để thầy nhận ra dòng
  const khongViTri = buildings.filter((b) => !(b.lat != null && b.lng != null && Number.isFinite(Number(b.lat))));
  return `<div class="ov">
    <section class="ov__hero">
      <p class="ov__eyebrow">Property Insight · Lưu ý về bộ dữ liệu 407 tòa</p>
      <div class="ov__bignum"><span class="ov__num">${ca.length}</span><span class="ov__unit">trường hợp<br>cần thầy xác nhận</span></div>
      <h2 class="ov__thesis">Những chỗ dữ liệu chưa chắc chắn</h2>
      <p class="ov__lede">Tên, địa chỉ và vị trí của 407 tòa đã được đối chiếu với trang rao (Maison Office, Saigon Office), Google Maps
        và tìm trên web. Trang này liệt kê những chỗ còn chưa chắc, để người đọc biết và để thầy xác nhận.</p>
    </section>

    <section class="ov__band" id="can-xac-nhan">
      <div class="ov__head"><p class="ov__sectag">01 · Cần xác nhận</p><h3>${ca.length} trường hợp cần thầy xác nhận</h3>
        <p class="ov__lede">Đã thử mọi cách đối chiếu nhưng vẫn còn hai khả năng, hoặc hai dòng có thể là một tòa nhập hai lần.</p></div>
      <ol class="ovxn">${ca.map((c) => `<li class="ovxn__ca ovxn__ca--${esc(c.muc)}">
        <div class="ovxn__dau"><span class="ovxn__muc">${esc(MUC[c.muc] || c.muc)}</span>
          <strong>${esc(c.tieu_de)}</strong><small>STT ${c.stt.map((s) => esc(s)).join(', ')}${c.stt.length ? ` · ${c.stt.map((s) => esc(ten.get(s) || '')).filter(Boolean).join(' / ')}` : ''}</small></div>
        <p>${esc(c.van_de)}</p>
        <p class="ovxn__so">${esc(c.so_lieu)}</p>
        <p class="ovxn__da">Đã làm: ${esc(c.da_lam)}</p>
        <p class="ovxn__hoi">${esc(c.cau_hoi)}</p>
      </li>`).join('')}</ol>
    </section>

    ${ly.length ? `<section class="ov__band" id="luu-y-ten-khac">
      <div class="ov__head"><p class="ov__sectag">02 · Tên khác</p><h3>Tòa mang tên khác trên trang rao</h3>
        <p class="ov__lede">Cùng số nhà nhưng trang rao dùng tên khác. Cặp nào web và giá cùng xác nhận là một tòa thì đã lấy giá trang rao.</p></div>
      <div class="tablewrap" tabindex="0" aria-label="Tòa mang tên khác trên trang rao"><table class="ovtable">
        <caption class="sr-only">Tòa có trang rao cùng số nhà nhưng khác tên, và đã ghép giá hay chưa.</caption>
        <thead><tr><th scope="col">STT</th><th scope="col">Tên trong bộ dữ liệu</th><th scope="col">Tên trên trang rao</th>
          <th scope="col">Địa chỉ</th><th scope="col">Ghi chú</th></tr></thead>
        <tbody>${ly.map((x) => `<tr>
          <td>${esc(x.stt)}</td><th scope="row">${esc(x.ten)}</th><td>${esc(x.ten_trang)}</td><td>${esc(x.dia_chi)}</td>
          <td><span class="ovly__nhan ovly__nhan--${x.da_ghep ? 'co' : 'chua'}">${x.da_ghep ? 'Đã ghép' : 'Chưa ghép'}</span> ${esc(x.ghi_chu)}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>` : ''}

    <section class="ov__band ov__band--notes" id="chua-co-vi-tri">
      <div class="ov__head"><p class="ov__sectag">03 · Vị trí</p><h3>${khongViTri.length} tòa chưa có vị trí trên bản đồ</h3>
        <p class="ov__lede">Đã xác định đúng tòa và địa chỉ, nhưng chưa có tọa độ đủ tin cậy, nên tòa vẫn có trong danh sách và bảng
          nhưng không có chấm trên bản đồ, và chưa có số đo khoảng cách.</p></div>
      <ul class="ovpv__ds">${khongViTri.map((b) => `<li><strong>STT ${esc(b.teacherNo)} · ${esc(b.name)}</strong>${b.address ? `, ${esc(b.address)}` : ''}</li>`).join('')}</ul>
    </section>
  </div>`;
}
