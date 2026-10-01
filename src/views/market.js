/* BIẾN ĐỘNG — giá chào hai kỳ trên Saigon Office và Maison Office (QĐ 189, 30/09/2026).

   Chỉ trình bày số đo được: dữ liệu sinh bởi atlas/06_PHAN_TICH/kich_ban/n27_bien_dong_gia_chao.py từ hai lần thu trang rao.
   Đây là GIÁ CHÀO cơ bản trên trang rao (chưa gồm phí dịch vụ), không trộn với giá niêm yết gồm phí của 407 toà (QĐ 191).
   01/10: thầy sẽ đọc kỹ phần này. Chủ dự án chỉ ra trang chưa nói phạm vi (tập tin rao lớn hơn và khác bộ 407 toà) và bảng
   quận không cộng đủ tổng. Nay mọi con số phạm vi đọc từ dữ liệu (pham_vi, quan_khac), không ghi cứng.
   Dùng lại khung của trang Tổng quan (ov, ovtable, tablewrap) để hai bề mặt "báo cáo" cùng một giọng. */

import { esc } from '../components/primitives.js';

const so = (x, d = 1) => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: d });
const pt = (x) => (x == null ? '—' : `${x > 0 ? '+' : ''}${so(x)}%`);
// Khoảng cách hai lần thu đọc từ dữ liệu (n27 ghi cach_ngay), vì dữ liệu có thể thu thêm kỳ.
const khoang = (n) => (n == null ? 'giữa hai lần thu'
  : n >= 45 ? `khoảng ${Math.round(n / 30)} tháng` : `khoảng ${Math.max(1, Math.round(n / 7))} tuần`);
const giuPt = (q) => so(100 * (q.so_duoc - q.tang - q.giam - (q.doi_khoang || 0)) / q.so_duoc, 0);

function bangTin(ds, nhan) {
  const dong = (x) => `<tr><th scope="row"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.ten)}</a></th>`
    + `<td>${esc(x.trang)}</td><td>${esc(x.quan)}</td>`
    + `<td>${x.stt_407 && x.stt_407.length ? `STT ${esc(x.stt_407.join(', '))}` : 'Không'}</td>`
    + `<td>${esc(x.chu_1)}</td><td>${esc(x.chu_2)}</td><td class="n">${pt(x.pt)}</td></tr>`;
  return `<div class="tablewrap" tabindex="0" aria-label="${esc(nhan)}"><table class="ovtable">
    <caption class="sr-only">${esc(nhan)}</caption>
    <thead><tr><th scope="col">Tòa nhà</th><th scope="col">Trang rao</th><th scope="col">Quận cũ</th><th scope="col">Trong bộ 407 tòa</th>`
    + `<th scope="col">Kỳ 1</th><th scope="col">Kỳ 2</th><th scope="col" class="n">Mức đổi</th></tr></thead>
    <tbody>${ds.map(dong).join('')}</tbody></table></div>`;
}

/* Bảng hai dòng ngay dưới con số lớn (01/10, chủ dự án: "nhìn 2.000 tin không hiểu là của toàn bộ hay 407"). */
function soSanh(d) {
  const v = d.pham_vi;
  const r = v?.rieng_407;
  if (!r) return '';
  const dong = (ten, tin, toa, giu, tang, giam) => `<tr><th scope="row">${ten}</th><td class="n">${so(tin, 0)}</td><td class="n">${toa}</td>`
    + `<td class="n">${so(100 * giu / tin, 1)}%</td><td class="n">${tang}</td><td class="n">${giam}</td></tr>`;
  return `<div class="ovsosanh">
        <p class="ovsosanh__mo">Con số lớn ở trên tính trên <strong>toàn bộ kho trang rao</strong>, không riêng 407 tòa. Dòng thứ hai tách riêng
          các tin thuộc 407 tòa của bộ dữ liệu.</p>
        <div class="tablewrap" tabindex="0" aria-label="So sánh toàn bộ kho trang rao với riêng 407 tòa"><table class="ovtable">
          <caption class="sr-only">Số tin, số tòa, tỷ lệ giữ nguyên giá, số tin tăng và giảm: toàn bộ kho trang rao và riêng 407 tòa.</caption>
          <thead><tr><th scope="col">Tập dữ liệu</th><th scope="col" class="n">Tin so được</th><th scope="col" class="n">Tòa</th>
            <th scope="col" class="n">Giữ nguyên giá</th><th scope="col" class="n">Tăng</th><th scope="col" class="n">Giảm</th></tr></thead>
          <tbody>
            ${dong('Toàn bộ kho trang rao (Maison Office, Saigon Office)', d.so_duoc, `ít nhất ${so(v.so_toa_ghep, 0)}`, d.giu_gia, d.tang, d.giam)}
            ${dong('Riêng 407 tòa của bộ dữ liệu', r.tin, `${r.toa}/407`, r.giu, r.tang, r.giam)}
          </tbody></table></div>
        <p class="ovsosanh__mo">Tin có hai đầu khoảng giá đi ngược chiều không xếp vào giữ nguyên, tăng hay giảm (${d.doi_khoang || 0} tin ở
          dòng đầu, ${r.doi_khoang} tin ở dòng sau).</p>
      </div>`;
}

function phamVi(d) {
  const v = d.pham_vi;
  if (!v) return '';
  const ngoai = Object.entries(v.ngoai_tphcm_cu || {});
  return `<div class="ovpv" id="pham-vi">
        <h3 class="ovpv__tieude">Phạm vi: đây không phải bộ dữ liệu 407 tòa</h3>
        <ul class="ovpv__ds">
          <li><strong>Nguồn.</strong> Hai trang môi giới: Maison Office (maisonoffice.vn) và Saigon Office (saigonoffice.com.vn).
            Giá chào là giá cơ bản trang rao ghi, chưa gồm phí dịch vụ; khác với giá niêm yết gồm phí dịch vụ của bộ 407 tòa.</li>
          <li><strong>Đơn vị đếm là tin.</strong> Một tin là trang của một tòa trên một trang rao. Tòa có mặt trên cả hai trang thì
            có hai tin, và mỗi tin được so riêng.</li>
          <li><strong>Quy mô.</strong> ${so(d.so_duoc, 0)} tin có giá ở cả hai lần thu (Maison Office ${so(v.maison, 0)},
            Saigon Office ${so(v.saigon, 0)}), thuộc ít nhất ${so(v.so_toa_ghep, 0)} tòa. ${so(v.tin_chua_ghep_toa, 0)} tin chưa ghép
            được với tòa nào, nên số tòa thật có thể lớn hơn.</li>
          <li><strong>Liên hệ với bộ 407 tòa.</strong> ${so(v.toa_407_co_tin, 0)}/407 tòa có ít nhất một tin trong tập này
            (${so(v.tin_thuoc_407, 0)} tin; ${so(v.tin_doi_thuoc_407, 0)} trong ${d.doi_gia} tin tăng hoặc giảm giá). Các tin còn lại
            là tòa ngoài bộ 407.</li>
          <li><strong>Địa bàn.</strong> TP.HCM theo ranh giới trước 07/2025${ngoai.length ? `, trừ ${ngoai.map(([q, n]) => `${n} tin ở ${esc(q)}`).join(', ')} (nay thuộc TP.HCM mới)` : ''};
            ${v.chua_ro_quan} tin chưa xác định được quận.</li>
          <li><strong>Hai lần thu.</strong> Kỳ 1 từ ${esc(d.ky_1)}, kỳ 2 từ ${esc(d.ky_2)}, cách nhau ${d.cach_ngay} ngày.</li>
          <li><strong>Tin không so được.</strong> Tổng ${so(v.tong_tin, 0)} tin xuất hiện ở ít nhất một lần thu: ${so(d.so_duoc, 0)} so được;
            ${so(v.khong_so_duoc_gia, 0)} không có giá bằng số ở ít nhất một kỳ (phần lớn ghi "liên hệ"); ${d.tin_moi} tin mới chỉ có ở
            kỳ 2; ${v.chua_thu_lai} tin chưa thu lại ở kỳ 2; ${d.bi_go} tin bị gỡ khỏi trang rao.</li>
        </ul>
      </div>`;
}

function bieuDoPhanBo(d) {
  const ds = d.phan_bo_doi || [];
  if (!ds.length) return '';
  const lon = Math.max(...ds.map((x) => x.n));
  return `<figure class="ovchart">
    <figcaption><strong>Mức đổi của ${d.doi_gia} tin tăng hoặc giảm giá chào</strong>
      <span>Số tin theo khoảng mức đổi, tính theo điểm giữa khoảng giá. Không vẽ ${so(d.giu_gia, 0)} tin giữ nguyên giá
        (cột ấy sẽ cao gấp khoảng ${Math.round(d.giu_gia / lon)} lần cột cao nhất) và ${d.doi_khoang || 0} tin có hai đầu khoảng giá đi ngược chiều.</span></figcaption>
    <div class="ovbars" role="img" aria-label="${esc(ds.map((x) => `${x.nhan}: ${x.n} tin`).join('; '))}">
      ${ds.map((x) => `<div class="ovbars__dong"><span class="ovbars__nhan">${esc(x.nhan)}</span>
        <span class="ovbars__truc"><span class="ovbars__thanh ovbars__thanh--${x.chieu === 'giảm' ? 'giam' : 'tang'}" style="width:${(100 * x.n / lon).toFixed(1)}%"></span></span>
        <span class="ovbars__so">${x.n} tin</span></div>`).join('')}
    </div>
  </figure>`;
}

export function renderMarket(d) {
  const dongQuan = (q, ten) => `<tr><th scope="row">${ten}</th><td class="n">${so(q.so_duoc, 0)}</td>`
    + `<td class="n">${giuPt(q)}%</td><td class="n">${q.tang}</td><td class="n">${q.giam}</td><td class="n">${pt(q.trung_vi_pt)}</td></tr>`;
  const quan = d.theo_quan.map((q) => dongQuan(q, esc(q.quan))).join('');
  const qk = d.quan_khac;
  const dongKhac = qk && qk.so_duoc
    ? dongQuan({ ...qk, trung_vi_pt: null }, `Các quận còn lại<small class="ovpv__nho">${esc(qk.ds.join(', '))}</small>`) : '';
  const tong = dongQuan({ so_duoc: d.so_duoc, tang: d.tang, giam: d.giam, doi_khoang: d.doi_khoang, trung_vi_pt: d.trung_vi_pt }, 'Tổng');
  return `<div class="ov">
    <section class="ov__hero">
      <p class="ov__eyebrow">Property Insight · Biến động giá chào trên trang rao</p>
      <div class="ov__bignum"><span class="ov__num">${so(100 * d.giu_gia / d.so_duoc, 1)}%</span><span class="ov__unit">tin giữ nguyên giá chào sau ${khoang(d.cach_ngay)},<br>trên toàn bộ kho trang rao (${so(d.so_duoc, 0)} tin, ít nhất ${so(d.pham_vi?.so_toa_ghep || 0, 0)} tòa)</span></div>
      <h2 class="ov__thesis">Giá chào trên hai trang rao, so giữa hai lần thu</h2>
      <p class="ov__lede">Mỗi tin chỉ được so với chính nó ở lần thu trước, trên cùng trang rao và cùng đường dẫn; không so giá
        giữa hai trang. ${so(d.giu_gia, 0)}/${so(d.so_duoc, 0)} tin giữ nguyên giá, nên mức đổi trung vị trên mọi tin là
        ${pt(d.trung_vi_moi_tin_pt)}.</p>
      ${soSanh(d)}
      ${phamVi(d)}
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">${d.tang}</span><span class="k">tin tăng giá chào</span></div>
        <div class="ov__stat"><span class="v">${d.giam}</span><span class="k">tin giảm giá chào</span></div>
        <div class="ov__stat"><span class="v">${pt(d.trung_vi_pt)}</span><span class="k">mức đổi trung vị của ${d.doi_gia} tin tăng hoặc giảm, tính theo điểm giữa khoảng giá (theo đầu thấp của khoảng: ${pt(d.trung_vi_dau_thap_pt)})</span></div>
        <div class="ov__stat"><span class="v">${d.doi_tu_15}</span><span class="k">tin đổi từ 15% trở lên (${so(100 * d.doi_tu_15 / d.so_duoc)}% số tin so được)</span></div>
        <div class="ov__stat"><span class="v">${d.tin_moi}</span><span class="k">tin mới chỉ có ở kỳ 2, không tính vào mức đổi</span></div>
        <div class="ov__stat"><span class="v">${d.bi_go}</span><span class="k">tin bị gỡ khỏi trang rao ở kỳ 2</span></div>
      </div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">01 · Phân bố</p><h3>Tin tăng và giảm giá chào đổi bao nhiêu</h3></div>
      <div class="ovchart-grid">${bieuDoPhanBo(d)}</div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">02 · Theo quận</p><h3>Mức đổi giá chào theo quận cũ</h3>
        <p class="ov__lede">Quận theo ranh giới trước 07/2025, lấy từ đường dẫn trang rao; đường dẫn không ghi quận thì theo ghim
          của trang rao. Bảng tách riêng quận có từ 20 tin; trung vị chỉ ghi khi quận có từ 5 tin tăng hoặc giảm.
          ${d.doi_khoang ? `${d.doi_khoang} tin có hai đầu khoảng giá đi ngược chiều không tính vào tăng, giảm hay giữ nguyên.` : ''}</p></div>
      <div class="tablewrap" tabindex="0" aria-label="Bảng mức đổi giá chào theo quận cũ"><table class="ovtable">
        <caption class="sr-only">Số tin so được, tỷ lệ giữ nguyên giá, số tin tăng, giảm và trung vị mức đổi theo quận cũ.</caption>
        <thead><tr><th scope="col">Quận cũ</th><th scope="col" class="n">Tin so được</th><th scope="col" class="n">Giữ nguyên giá</th>`
    + `<th scope="col" class="n">Tăng</th><th scope="col" class="n">Giảm</th><th scope="col" class="n">Trung vị, chỉ tin tăng hoặc giảm</th></tr></thead>
        <tbody>${quan}${dongKhac}</tbody>
        <tfoot>${tong}</tfoot></table></div>
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">03 · Giảm nhiều nhất</p><h3>10 tin giảm giá chào mạnh nhất</h3>
        <p class="ov__lede">Giá ghi đúng như trên trang rao; với khoảng giá, mức đổi tính theo điểm giữa. Cột "Trong bộ 407 tòa"
          cho biết tin thuộc tòa nào của bộ dữ liệu. Bấm tên tòa để mở tin.</p></div>
      ${bangTin(d.giam_nhieu, '10 tin giảm giá chào mạnh nhất')}
    </section>

    <section class="ov__band">
      <div class="ov__head"><p class="ov__sectag">04 · Tăng nhiều nhất</p><h3>10 tin tăng giá chào mạnh nhất</h3></div>
      ${bangTin(d.tang_nhieu, '10 tin tăng giá chào mạnh nhất')}
    </section>

    <section class="ov__band ov__band--notes">
      <div class="ov__head"><p class="ov__sectag">05 · Lưu ý</p><h3>Khi đọc số liệu</h3></div>
      <div class="ov__stats">
        <div class="ov__stat"><span class="v">01</span><span class="k">Giá chào là giá trang rao ghi, chưa gồm phí dịch vụ; không phải giá ký hợp đồng. Giá 03/2026 của 407 tòa là giá niêm yết đã gồm phí dịch vụ, nên không so trực tiếp hai con số.</span></div>
        <div class="ov__stat"><span class="v">02</span><span class="k">Hai lần thu cách nhau ${d.cach_ngay} ngày, chưa đủ để nói về xu hướng thị trường.</span></div>
        <div class="ov__stat"><span class="v">03</span><span class="k">Giữ nguyên giá chào chưa chắc là thị trường đứng yên: trang rao có thể chưa cập nhật giá. Chưa đo được mỗi trang cập nhật giá thường xuyên đến đâu.</span></div>
        <div class="ov__stat"><span class="v">04</span><span class="k">${d.doi_kem_dien_tich}/${d.doi_gia} tin tăng hoặc giảm giá cũng đổi diện tích đang chào, nên mức đổi có thể do chào phần diện tích khác. Chỉ Saigon Office ghi diện tích trống; Maison Office không ghi, nên ở trang này không kiểm được điều đó.</span></div>
        <div class="ov__stat"><span class="v">05</span><span class="k">Giá ghi theo khoảng thì mức đổi tính theo điểm giữa. ${d.doi_khoang || 0} tin có hai đầu khoảng đi ngược chiều (ví dụ 23 - 24 thành 21 - 25) nên không xếp vào tăng hay giảm.</span></div>
        <div class="ov__stat"><span class="v">06</span><span class="k">Quận lấy từ đường dẫn trang rao; với tin không ghi quận thì theo ghim của chính trang rao, và ghim này có thể đặt sai chỗ.</span></div>
      </div>
    </section>
  </div>`;
}
