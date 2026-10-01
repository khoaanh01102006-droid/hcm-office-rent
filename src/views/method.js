import { icon } from '../icons.js';
import { esc } from '../components/primitives.js';
import { dateTime } from '../format.js';

/* Trang Phương pháp: nơi duy nhất giải thích cách tính và giới hạn (quy ước viết
   nang_cap/06_QUY_UOC_VIET_PI.md, quy tắc 3). Các nhãn trên bản đồ chỉ ghi nguồn một dòng. */
export function renderMethod(data, mapMeta) {
  const buildings = data.buildings;
  const withCoordinates = buildings.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng)).length;
  const manual = buildings.length - withCoordinates;
  const obsDate = buildings.find((b) => b.trafficObservationDate)?.trafficObservationDate;

  return `<div class="pf">
    <section class="pf__sec pf__sec--lead">
      <h4>${icon('layers', { size: 15 })} Dữ liệu</h4>
      <dl class="pf__dl">
        <dt>Tòa nhà</dt><dd>${buildings.length} tòa văn phòng tại TP.HCM, ${withCoordinates} tòa có tọa độ</dd>
        <dt>Giá thuê</dt><dd>Giá niêm yết tháng 03/2026, USD/m²/tháng, gồm phí dịch vụ, chưa VAT. Đối chiếu với trang rao
          của chính tòa đó: 157/248 tòa có giá khớp trong ±5% với giá cơ bản cộng phí dịch vụ; chỉ 25 tòa khớp với giá cơ bản
          và 50 tòa khớp với giá đã gồm VAT. Đây là giá niêm yết, không phải giá ký hợp đồng.</dd>
        <dt>Diện tích, lấp đầy, hạng</dt><dd>Diện tích cho thuê thực (NLA), tỷ lệ lấp đầy và hạng tòa nhà tháng
          03/2026, theo cùng nguồn.</dd>
        <dt>Dữ liệu thiếu</dt><dd>Để trống, không thay bằng 0 và không ước đoán.</dd>
        <dt>Cập nhật</dt><dd>${esc(dateTime(data.generatedAt))}</dd>
      </dl>
    </section>

    <section class="pf__sec">
      <div class="pf__sechead"><h4>${icon('map', { size: 15 })} Tọa độ tòa nhà</h4></div>
      <ol class="method__steps">
        <li><span>01</span><div>Xác định đúng tòa nhà: đối chiếu tên, tên cũ, số nhà, tên đường và quận từ nhiều nguồn.</div></li>
        <li><span>02</span><div>Dùng vị trí trên Google Maps khi cả tên và địa chỉ đều khớp.</div></li>
        <li><span>03</span><div>Không có vị trí khớp thì dùng điểm địa chỉ đã được nhiều nguồn xác nhận.</div></li>
        <li><span>04</span><div>Chưa đủ căn cứ thì để trống. Hiện ${manual} tòa chưa có tọa độ nên chỉ có trong danh sách.</div></li>
      </ol>
    </section>

    <section class="pf__sec">
      <div class="pf__sechead"><h4>${icon('clock', { size: 15 })} Khoảng cách và thời gian</h4></div>
      <dl class="pf__dl">
        <dt>Đường thẳng</dt><dd>Khoảng cách giữa hai tọa độ; dùng cho ga metro, trung tâm (UBND Thành phố) và sân bay.</dd>
        <dt>Đi bộ</dt><dd>Theo mạng đường OpenStreetMap, tốc độ 75 m/phút. Không tính đèn tín hiệu, cầu vượt
          hay chất lượng vỉa hè.</dd>
        <dt>Lái xe</dt><dd>Quãng đường theo mạng đường OpenStreetMap. Thời gian là một khoảng, tính với tốc độ trung bình
          21 km/h ngoài giờ cao điểm và 12 km/h giờ cao điểm (7–9h, 17–19h), theo Sở GTVT TP.HCM.</dd>
        ${obsDate ? `<dt>Lái xe có xét giao thông</dt><dd>Một lần đo qua Google Routes lúc 08:04 ngày ${esc(obsDate)};
          chưa đại diện cho các giờ và ngày khác.</dd>` : ''}
      </dl>
    </section>

    <section class="pf__sec">
      <div class="pf__sechead"><h4>${icon('scale', { size: 15 })} Tiện ích quanh tòa nhà</h4></div>
      <dl class="pf__dl">
        <dt>Khung tham chiếu</dt>
        <dd>Mật độ, đa dạng, thiết kế: Cervero, R. và Kockelman, K. (1997). <em>Travel demand and the 3Ds:
          Density, diversity, and design.</em> Transportation Research Part D 2(3), 199–219.</dd>

        <dt>Mật độ</dt>
        <dd>Số địa điểm đi bộ tới được trong 400 m và 800 m, tương ứng ¼ và ½ dặm theo hướng dẫn đi bộ
          tới điểm trung chuyển của FHWA.</dd>

        <dt>Độ đa dạng</dt>
        <dd><code>E = −Σ(p<sub>k</sub> · ln p<sub>k</sub>) / ln N</code>, với <code>p<sub>k</sub></code> là tỷ trọng
          nhóm <em>k</em> và N = 8 nhóm. Giá trị từ 0 (chỉ một loại) đến 1 (tám nhóm đều nhau).</dd>

        <dt>Tám nhóm</dt>
        <dd>Ăn uống, ngân hàng, đi lại, mua sắm, y tế, thể thao, khách sạn, bãi đỗ xe. Nguồn: OpenStreetMap.</dd>

        <dt>Google Places</dt>
        <dd>Dùng cho danh sách tiện ích trong trang chi tiết khi tòa nhà chưa có dữ liệu OpenStreetMap;
          không hiện trên bản đồ nền OpenStreetMap.</dd>
      </dl>
      <p class="pf__note">Giới hạn: chỉ đếm địa điểm có tên trên OpenStreetMap, và mức độ đầy đủ của bản đồ khác nhau
        giữa các khu vực. Mọi địa điểm được tính như nhau, không phân biệt quy mô.</p>
    </section>

    <section class="pf__sec">
      <div class="pf__sechead"><h4>${icon('map', { size: 15 })} Bản đồ và giấy phép</h4></div>
      <dl class="pf__dl">
        <dt>Thư viện</dt><dd>${esc(mapMeta.engine)}</dd>
        <dt>Nền bản đồ</dt><dd>${esc(mapMeta.basemap)}</dd>
        <dt>Metro số 1</dt><dd>${esc(mapMeta.metroGeometry)}</dd>
        <dt>Dữ liệu nền</dt><dd>© những người đóng góp OpenStreetMap, ODbL 1.0.</dd>
        <dt>Tiện ích và lộ trình</dt><dd>Google Places API và Google Routes API.</dd>
      </dl>
    </section>

    <p class="pf__note pf__note--status">Trang dùng để tra cứu và so sánh, không thay cho khảo sát thực địa.</p>
  </div>`;
}
