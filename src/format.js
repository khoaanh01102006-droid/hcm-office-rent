/* Định dạng số và ngày theo quy ước tiếng Việt.
   Không có hàm nào ở đây được phép sinh ra giá trị thay cho dữ liệu thiếu. */

const nf = (min, max) => new Intl.NumberFormat('vi-VN', { minimumFractionDigits: min, maximumFractionDigits: max });

export const num = (v, min = 0, max = 1) => (v == null ? null : nf(min, max).format(v));

/** Giá: luôn một chữ số thập phân để cột số thẳng hàng. */
export const money = (v) => (v == null ? null : nf(1, 1).format(v));

/** Khoảng cách: dưới 1 km hiển thị mét, từ 1 km hiển thị km với 1 số lẻ. */
export function distance(m) {
  if (m == null) return null;
  return m < 1000 ? `${nf(0, 0).format(Math.round(m))} m` : `${nf(1, 1).format(m / 1000)} km`;
}

export const percent = (v, max = 1) => (v == null ? null : `${nf(0, max).format(v)}%`);

/** Chấp nhận cả "2026-07-30 16:45:25" lẫn ISO. */
export function parseDate(s) {
  if (!s) return null;
  const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T'));
  return Number.isNaN(+d) ? null : d;
}

export function dateShort(s) {
  const d = parseDate(s);
  if (!d) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function dateTime(s) {
  const d = parseDate(s);
  if (!d) return null;
  return `${dateShort(s)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "cách đây 25 ngày" — giúp người đọc cảm nhận độ tươi của dữ liệu. */
export function ageInDays(s, now = new Date()) {
  const d = parseDate(s);
  if (!d) return null;
  return Math.floor((now - d) / 86400000);
}

export const gradeShort = (g) => ({ A: 'A', B_PLUS: 'B+', B: 'B', C: 'C' }[g] || g);

/** Rút gọn primaryType của Google Places thành nhãn tiếng Việt đọc được. */
const PLACE_TYPE = {
  pizza_restaurant: 'Nhà hàng pizza', restaurant: 'Nhà hàng', vietnamese_restaurant: 'Nhà hàng Việt',
  japanese_restaurant: 'Nhà hàng Nhật', korean_restaurant: 'Nhà hàng Hàn', chinese_restaurant: 'Nhà hàng Trung',
  italian_restaurant: 'Nhà hàng Ý', french_restaurant: 'Nhà hàng Pháp', thai_restaurant: 'Nhà hàng Thái',
  seafood_restaurant: 'Nhà hàng hải sản', barbecue_restaurant: 'Nhà hàng nướng', buffet_restaurant: 'Buffet',
  cafe: 'Quán cà phê', coffee_shop: 'Quán cà phê', bakery: 'Tiệm bánh', bar: 'Quán bar',
  fast_food_restaurant: 'Đồ ăn nhanh', hamburger_restaurant: 'Nhà hàng burger', sushi_restaurant: 'Nhà hàng sushi',
  bank: 'Ngân hàng', atm: 'ATM',
  gym: 'Phòng tập', fitness_center: 'Trung tâm thể hình', yoga_studio: 'Phòng yoga',
  sports_club: 'Câu lạc bộ thể thao', swimming_pool: 'Bể bơi', spa: 'Spa',
  hotel: 'Khách sạn', resort_hotel: 'Resort', extended_stay_hotel: 'Khách sạn lưu trú dài ngày',
  budget_japanese_inn: 'Nhà nghỉ', bed_and_breakfast: 'Nhà nghỉ',
  parking_lot: 'Bãi đỗ xe', parking_garage: 'Nhà xe', rest_stop: 'Điểm dừng',
  bus_stop: 'Trạm xe buýt', transit_station: 'Trạm trung chuyển', subway_station: 'Ga metro',
  convenience_store: 'Cửa hàng tiện lợi', supermarket: 'Siêu thị', grocery_store: 'Cửa hàng thực phẩm',
  shopping_mall: 'Trung tâm mua sắm', department_store: 'Bách hóa',
  park: 'Công viên', garden: 'Vườn',
  hospital: 'Bệnh viện', medical_clinic: 'Phòng khám', doctor: 'Bác sĩ', pharmacy: 'Nhà thuốc',
};
export const placeType = (t) => PLACE_TYPE[t] || (t ? String(t).replace(/_/g, ' ') : null);

/** Nhãn trạng thái hoạt động của địa điểm — giữ nguyên nghĩa của nguồn. */
export const businessStatusLabel = (s) =>
  ({ OPERATIONAL: 'Đang hoạt động', CLOSED_TEMPORARILY: 'Tạm ngừng hoạt động', CLOSED_PERMANENTLY: 'Đã đóng cửa' }[s] || s);
