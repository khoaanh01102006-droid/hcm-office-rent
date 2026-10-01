/* CHẾ ĐỘ HIỂN THỊ (01/10, chủ dự án: "thêm mục lớn ngay giữa thanh trắng để đổi sang phiên bản đầy đủ tất cả các tòa nhà và các
   tin đã thu thập").

   '407'    — mặc định: 407 tòa của bộ dữ liệu, giá niêm yết 03/2026 gồm phí dịch vụ.
   'day_du' — ?ban=day-du: 407 tòa + tòa trên trang rao (Maison Office, Saigon Office), MỌI tòa dùng GIÁ CHÀO (giá cơ bản trên
              trang rao, chưa gồm phí dịch vụ), một thang. Dữ liệu ở data/rieng/ (n37_ban_day_du.py); tọa độ tòa trang rao là ghim
              Google nên bản này chỉ dùng nền Google (điều khoản) và chỉ chạy trên máy chủ dự án (chế độ chia sẻ chặn data/rieng/).

   Đổi chế độ = tải lại trang với tham số khác. Nhờ vậy mọi nhãn đọc MỘT lần từ đây, không phải dựng lại từng thành phần khi đang
   chạy. Hai loại giá không bao giờ trộn trên một thang. */

const thamSo = new URLSearchParams(location.search);
export const DAY_DU = thamSo.get('ban') === 'day-du';
export const BAN = DAY_DU ? 'day_du' : '407';

const nhanDayDu = (ky) => ({
  giaNgan: `giá chào ${ky}`,
  giaTieuDe: `Giá chào ${ky}`,
  giaDai: `Giá chào trên trang rao, lần thu ${ky}: giá cơ bản, chưa gồm phí dịch vụ, chưa VAT`,
  giaCoSo: 'giá cơ bản trên trang rao, chưa gồm phí dịch vụ',
  dinhNghiaGia: `Giá chào trên trang rao (lần thu ${ky}), giá cơ bản chưa gồm phí dịch vụ và VAT; khoảng giá lấy điểm giữa, nhiều trang thì lấy trung vị.`,
  tap: 'phiên bản đầy đủ',
});

export const NHAN = DAY_DU ? nhanDayDu('09/2026') : {
  giaNgan: 'giá niêm yết 03/2026',
  giaTieuDe: 'Giá niêm yết 03/2026',
  giaDai: 'Giá niêm yết tháng 03/2026, gồm phí dịch vụ, chưa VAT',
  giaCoSo: 'gồm phí dịch vụ',
  dinhNghiaGia: 'Giá niêm yết tháng 03/2026, gồm phí dịch vụ, chưa VAT.',
  tap: 'bộ dữ liệu 407 tòa',
};

export const DUONG_DAN = DAY_DU
  ? { payload: './data/rieng/pi_day_du.json', gia: './data/rieng/gia_day_du.json' }
  : { payload: './data/pilot_12_buildings_full.json', gia: './data/gia_nhieu_nguon.json' };

/** Kỳ giá đọc từ dữ liệu (n37 ghi banDayDu.ky_gia theo lần thu mới nhất), gọi một lần sau khi nạp. */
export function datKyGia(ky) {
  if (DAY_DU && ky) Object.assign(NHAN, nhanDayDu(ky));
}

export const LINK_407 = location.pathname;
export const LINK_DAY_DU = `${location.pathname}?ban=day-du`;
