/* BIẾN ĐỘNG — giá chào hai kỳ trên Saigon Office và Maison Office (QĐ 189, 30/09/2026).

   Chỉ trình bày số đo được: dữ liệu sinh bởi atlas/06_PHAN_TICH/kich_ban/n27_bien_dong_gia_chao.py từ hai lần thu trang rao.
   Đây là GIÁ CHÀO cơ bản trên trang rao (chưa gồm phí dịch vụ), không trộn với giá niêm yết gồm phí của 407 toà (QĐ 191).
   Dùng lại khung của trang Tổng quan (ov, ovtable, tablewrap) để hai bề mặt "báo cáo" cùng một giọng. */

import { esc } from '../components/primitives.js';

const so = (x, d = 1) => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: d });
const pt = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${so(x)}%`);
// Khoảng cách hai lần thu đọc từ dữ liệu (n27 ghi cach_ngay), vì từ 10/2026 dữ liệu tự thu mỗi tháng.
const khoang = (n) => (n == null ? 'giữa hai lần thu'
  : n >= 45 ? `khoảng ${Math.round(n / 30)} tháng` : `khoảng ${Math.max(1, Math.round(n / 7))} tuần`);

function bangTin(ds, nhan) {
  const dong = (x) => `<tr><th scope="row"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.ten)}</a></th>`
    + `<td>${esc(x.trang)}</td><td>${esc(x.quan)}</td><td>${esc(x.chu_1)}</td><td>${esc(x.chu_2)}</td>`
    + `<td class="n">${pt(x.pt)}</td></tr>`;
  return `<div class="tablewrap" tabindex="0" aria-label="${esc(nhan)}"><table class="ovtable">
    <caption class="sr-only">${esc(nhan)}</caption>
    <thead><tr><th scope="col">Tòa nhà</th><th scope="col">Trang rao</th><th scope="col">Quận cũ</th>`
    + `<th scope="col">Kỳ 1</th><th scope="col">Kỳ 2</th><th scope="col" class="n">Mức đổi</th></tr></thead>
    <tbody>${ds.map(dong).join('')}</tbody></table></div>`;
}

export function renderMarket(d) {
  const quan = d.theo_quan.map((q) => `<tr><th scope="row">${esc(q.quan)}</th><td class="n">${so(q.so_duoc, 0)}</td>`
    + `<td class="n">${so(100 * (q.so_duoc - q.tang - q.giam - (q.doi_khoang || 0)) / q.so_duoc, 0)}%</td>`
    + `<td class="n">${q.tang}</td><td class="n">${q.giam}</td><td class="n">${pt(q.trung_vi_pt)}</td></tr>`).join('');
  return `<div class="ov">
    <section class="ov__hero">
      <p class="ov__eyebrow">Property Insight · Biến động giá chào</p>
      <div class="ov__bignum"><span class="ov__num">${so(100 * d.giu_gia / d.so_duoc, 0)}%</span><span class="ov__unit">tin giữ nguyên giá chào<br>sau ${khoang(d.cach_ngay)}</span></div>
      <h2 class="ov__thesis">Thay đổi giá chào giữa hai lần thu</h2>
      <p class="ov__lede">Mỗi tin được so với chính nó ở lần thu trước, trên cùng trang rao (Saigon Office hoặc Maison Office);
        không so giá giữa hai trang. Kỳ 1 thu từ ${esc(d.ky_1)}, kỳ 2 từ ${esc(d.ky_2)}.
        ${so(d.so_duoc, 0)} tin có giá để so; tin ghi "liên hệ" không tính. Mức đổi trung vị trên mọi tin: ${pt(d.trung_vi_moi_tin_pt)}.
        Đây là giá chào cơ bản trên trang rao, chưa gồm phí dịch vụ.</p>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">${d.tang}</span><span class="k">tin tăng giá chào</span></div>
        <div class="ov__stat"><span class="v">${d.giam}</span><span class="k">tin giảm giá chào</span></div>
        <div class="ov__stat"><span class="v">${pt(d.trung_vi_pt)}</span><span class="k">mức đổi trung vị của ${d.doi_gia} tin tăng hoặc giảm, theo điểm giữa khoảng giá (theo đầu thấp: ${pt(d.trung_vi_dau_thap_pt)})</span></div>
        <div class="ov__stat"><span class="v">${d.doi_tu_15}</span><span class="k">tin đổi từ 15% trở lên (${so(100 * d.doi_tu_15 / d.so_duoc)}% số tin)</span></div>
        <div class="ov__stat"><span class="v">${d.tin_moi}</span><span class="k">tin mới xuất hiện ở kỳ 2</span></div>
        <div class="ov__stat"><span class="v">${d.bi_go}</span><span class="k">tin bị gỡ khỏi trang rao</span></div>
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">01 · Theo quận</p><h3>Mức đổi giá chào theo quận cũ</h3>
        <p class="ov__lede">Quận theo ranh giới trước 07/2025. Trung vị chỉ tính tin có đổi giá, và chỉ ghi khi quận có từ 5 tin đổi.</p></div>
      <div class="tablewrap" tabindex="0" aria-label="Bảng mức đổi giá chào theo quận cũ"><table class="ovtable">
        <caption class="sr-only">Số tin so được, tỷ lệ giữ nguyên giá, số tin tăng, giảm và trung vị mức đổi theo quận cũ.</caption>
        <thead><tr><th scope="col">Quận cũ</th><th scope="col" class="n">Tin so được</th><th scope="col" class="n">Giữ nguyên giá</th>`
    + `<th scope="col" class="n">Tăng</th><th scope="col" class="n">Giảm</th><th scope="col" class="n">Trung vị, chỉ tin có đổi</th></tr></thead>
        <tbody>${quan}</tbody></table></div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">02 · Giảm nhiều nhất</p><h3>10 tin giảm giá chào mạnh nhất</h3>
        <p class="ov__lede">Giá ghi như trên trang rao; với khoảng giá, mức đổi tính theo điểm giữa. Bấm tên tòa để mở tin.</p></div>
      ${bangTin(d.giam_nhieu, '10 tin giảm giá chào mạnh nhất')}
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">03 · Tăng nhiều nhất</p><h3>10 tin tăng giá chào mạnh nhất</h3></div>
      ${bangTin(d.tang_nhieu, '10 tin tăng giá chào mạnh nhất')}
    </section>

    <section class="ov__band ov__band--notes">
      <div class="ov__head"><p class="ov__sectag">04 · Lưu ý</p><h3>Khi đọc số liệu</h3></div>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">01</span><span class="k">Giá chào ở đây là giá cơ bản, chưa gồm phí dịch vụ; giá 03/2026 của 407 tòa gồm phí dịch vụ, nên không so trực tiếp hai con số.</span></div>
        <div class="ov__stat"><span class="v">02</span><span class="k">Hai lần thu cách nhau ${khoang(d.cach_ngay)}, chưa đủ để kết luận xu hướng.</span></div>
        <div class="ov__stat"><span class="v">03</span><span class="k">Mỗi tin chỉ so với chính nó ở kỳ trước; tin mới và tin bị gỡ không tính vào mức đổi.</span></div>
        <div class="ov__stat"><span class="v">04</span><span class="k">${d.doi_kem_dien_tich}/${d.doi_gia} tin đổi giá cũng đổi diện tích đang chào, nên mức đổi có thể do chào phần diện tích khác. Trang Maison không ghi diện tích trống.</span></div>
        <div class="ov__stat"><span class="v">05</span><span class="k">Giá ghi theo khoảng thì mức đổi tính theo điểm giữa. ${d.doi_khoang || 0} tin có hai đầu khoảng đi ngược chiều (ví dụ 23 - 24 thành 21 - 25) nên không xếp vào tăng hay giảm.</span></div>
      </div>
    </section>
  </div>`;
}
