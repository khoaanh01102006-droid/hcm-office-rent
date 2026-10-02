/* =========================================================================
   Tầng dữ liệu — OFFICE-UX-PILOT-004

   QUY TẮC BẤT BIẾN CỦA TỆP NÀY:
   1. Không tạo giá trị mới. Không nội suy, không giá trị mặc định, không
      thay thiếu bằng 0. Thiếu là thiếu, và được biểu diễn tường minh.
   2. Không sửa dữ liệu nguồn. Tệp payload chỉ được đọc.
   3. Mọi con số hiển thị được đều mang theo nguồn và thời điểm truy xuất.
   4. Không tính bất kỳ đại lượng tổng hợp nào ngụ ý toàn thị trường
      (trung bình, phân vị, xếp hạng, "rẻ nhất khu vực"). n = 407.
   ========================================================================= */

/** Trạng thái của một trường dữ liệu. Bốn trạng thái, không phải hai. */
import { NHAN, DUONG_DAN, datKyGia } from './che_do.js';

export const FieldState = {
  PRESENT: 'present',           // có quan sát
  NOT_COLLECTED: 'not_collected', // chưa thu thập trong bản thử này
  NOT_PUBLISHED: 'not_published', // nguồn tồn tại nhưng không công bố (vd. "Liên hệ")
  ZERO_OBSERVED: 'zero_observed', // đã tìm theo phương pháp đã nêu và không có kết quả
};

/**
 * Bọc một giá trị kèm nguồn gốc. Đây là đơn vị duy nhất mà giao diện được
 * phép hiển thị — không có đường tắt nào trả về số trần.
 */
export function field(value, meta = {}) {
  const missing = value === null || value === undefined || value === '';
  return {
    value: missing ? null : value,
    state: missing ? (meta.state || FieldState.NOT_COLLECTED) : (meta.state || FieldState.PRESENT),
    raw: meta.raw ?? null,             // chuỗi gốc từ trang nguồn
    unit: meta.unit ?? null,
    sourceName: meta.sourceName ?? null,
    sourceUrl: meta.sourceUrl ?? null,
    retrievedAt: meta.retrievedAt ?? null,
    definition: meta.definition ?? null, // câu định nghĩa bắt buộc, vd "đường thẳng"
    note: meta.note ?? null,
  };
}

export const isPresent = (f) => f && f.state === FieldState.PRESENT;

const AMENITY_GROUPS = [
  { key: 'bus', label: 'Trạm xe buýt', need: 'Tiếp cận giao thông công cộng' },
  { key: 'parking', label: 'Bãi đỗ xe', need: 'Xe khách và xe nhân viên' },
  { key: 'bank_atm', label: 'Ngân hàng / ATM', need: 'Giao dịch và thủ tục' },
  { key: 'convenience_store', label: 'Cửa hàng tiện lợi', need: 'Nhu cầu hằng ngày' },
  { key: 'cafe', label: 'Cà phê', need: 'Gặp gỡ và làm việc ngắn' },
  { key: 'restaurant', label: 'Nhà hàng', need: 'Bữa trưa và tiếp khách' },
  { key: 'hotel', label: 'Khách sạn', need: 'Khách và chuyên gia lưu trú' },
  { key: 'healthcare', label: 'Y tế', need: 'Tiếp cận chăm sóc sức khỏe' },
  { key: 'park', label: 'Công viên', need: 'Không gian xanh và nghỉ ngắn' },
  { key: 'shopping_mall', label: 'Trung tâm thương mại', need: 'Dịch vụ và mua sắm' },
];

/** Mười nhóm tiện ích đã thu thập cho bộ V8.1. */
export const amenityGroups = AMENITY_GROUPS;

/** Các nhóm mới chỉ tồn tại trong lộ trình — không được hiện như quan sát. */
export const roadmapAmenityGroups = [
  'Trường học', 'Rạp phim', 'Cơ quan công quyền', 'Dữ liệu môi trường',
  'Mật độ cây xanh', 'Thu nhập khu vực', 'Lượt người qua lại',
];

const GRADE_ORDER = { A: 0, B_PLUS: 1, B: 2, C: 3 };

const DISTRICT_LABEL = {
  'quan-1': 'Quận 1', 'quan-2': 'Quận 2', 'quan-3': 'Quận 3',
  'quan-7': 'Quận 7', 'quan-10': 'Quận 10',
  'quan-binh-thanh': 'Bình Thạnh', 'quan-tan-binh': 'Tân Bình',
  // Bộ 407 tòa ghi quận bằng tên tiếng Anh không dấu ("District 1", "Binh Thanh"); giao diện hiện tên Việt.
  'Binh Thanh': 'Bình Thạnh', 'Phu Nhuan': 'Phú Nhuận', 'Tan Binh': 'Tân Bình', 'Tan Phu': 'Tân Phú',
  'Binh Chanh': 'Bình Chánh', 'Go Vap': 'Gò Vấp', 'Nha Be': 'Nhà Bè', 'Thu Duc': 'Thủ Đức',
  'Binh Tan': 'Bình Tân', 'Hoc Mon': 'Hóc Môn', 'Cu Chi': 'Củ Chi', 'Can Gio': 'Cần Giờ',
};
const districtVi = (d) => DISTRICT_LABEL[d] || (/^District (\d+)$/.test(d || '') ? `Quận ${d.split(' ')[1]}` : d);

const SUBMARKET_LABEL = {
  cbd_core: 'Lõi trung tâm', cbd_extended: 'Trung tâm mở rộng',
  eastern_thu_thiem_thu_duc: 'Phía Đông — Thủ Thiêm / Thủ Đức',
  southern_district_7: 'Phía Nam — Quận 7', binh_thanh: 'Bình Thạnh',
  airport_tan_binh_phu_nhuan: 'Sân bay — Tân Bình / Phú Nhuận',
  other_decentralized: 'Phi trung tâm khác',
};

const CROSSCHECK_LABEL = {
  AGREE_WITHIN_10_PERCENT: { text: 'Hai nguồn lệch dưới 10%', tone: 'ok' },
  AGREE_WITHIN_20_PERCENT: { text: 'Hai nguồn lệch dưới 20%', tone: 'warn' },
  UNRESOLVED_COMPONENTS: { text: 'Một nguồn giá', tone: 'missing' },
};

const SOURCE_LABEL = {
  maisonoffice: 'MaisonOffice', saigonoffice: 'SaigonOffice',
  teacher_file: 'Bộ dữ liệu 03/2026',
};

const SOURCE_STATUS_LABEL = {
  ANALYTICALLY_READY: 'Đủ điều kiện phân tích',
  EXCLUDE_NO_PUBLIC_BASE_RENT: 'Nguồn không công bố giá cơ bản',
  SOURCE_FILE_VALUE: 'Giá niêm yết, gồm phí dịch vụ, chưa VAT',
};

/* Tên 14 ga Metro số 1 trong dữ liệu gốc là tiếng Anh không dấu ("Ben Thanh", "Opera House");
   giao diện hiện tên tiếng Việt theo biển ga. */
const METRO_VI = {
  'Ben Thanh': 'Bến Thành', 'Opera House': 'Nhà hát Thành phố', 'Ba Son': 'Ba Son',
  'Van Thanh Park': 'Công viên Văn Thánh', 'Tan Cang': 'Tân Cảng', 'Thao Dien': 'Thảo Điền',
  'An Phu': 'An Phú', 'Rach Chiec': 'Rạch Chiếc', 'Phuoc Long': 'Phước Long', 'Binh Thai': 'Bình Thái',
  'Thu Duc': 'Thủ Đức', 'Hi-Tech Park': 'Khu Công nghệ cao', 'High Tech Park': 'Khu Công nghệ cao',
  'Saigon Hi-tech Park': 'Khu Công nghệ cao', 'National University': 'Đại học Quốc gia',
  'Suoi Tien Terminal': 'Bến xe Suối Tiên', 'Suoi Tien': 'Bến xe Suối Tiên',
};
export const metroVi = (n) => (n == null ? n : METRO_VI[n] || n);

/** Đọc payload và dựng mô hình hiển thị. Không ghi, không sửa tệp gốc. */
export async function loadPilot() {
  const [payload, methodology] = await Promise.all([
    fetch(DUONG_DAN.payload).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }),
    fetch('./data/pilot_methodology.json').then((r) => r.json()),
  ]);

  datKyGia(payload.banDayDu?.ky_gia);   // nhãn kỳ giá của phiên bản đầy đủ đọc từ dữ liệu, trước khi dựng định nghĩa trường giá
  const buildings = payload.records.map((rec) => buildModel(rec, payload));

  return {
    packageId: payload.packageId,
    generatedAt: payload.generatedAt,
    scope: payload.scope,
    methodology: payload.methodology,
    methodologyFile: methodology,
    metroStations: (payload.metroLine1 || []).map((s) => ({ ...s, name: metroVi(s.name) })),
    buildings,
    /** Cỡ mẫu — phải đi kèm mọi con số tổng hợp trên giao diện. */
    sampleSize: buildings.length,
    /** Cửa sổ thu thập giá thật, đọc từ dữ liệu chứ không viết cứng. */
    priceWindow: priceWindow(buildings),
    /** Phiên bản đầy đủ (n37): số tòa theo nguồn, kỳ giá, hạn tọa độ Google. */
    banDayDu: payload.banDayDu || null,
  };
}

function priceWindow(buildings) {
  const ts = buildings
    .flatMap((b) => b.sources.map((s) => s.retrievedAt))
    .filter(Boolean)
    .map((s) => new Date(s.replace(' ', 'T')))
    .filter((d) => !Number.isNaN(+d))
    .sort((a, b) => a - b);
  return ts.length ? { from: ts[0], to: ts[ts.length - 1] } : null;
}

function buildModel(rec, payload) {
  const b = rec.building;
  const e = rec.pilotEnrichment || {};
  const r5 = b.r5Spatial || {};
  const r5Hospital = r5.hospital || {};
  const r5Metro = r5.metro || {};
  const r5Green = r5.green || {};
  const sources = Array.isArray(b.sources) ? b.sources : [];
  const selected = sources.find((s) => s.selected) || sources[0] || {};
  const srcMeta = {
    sourceName: SOURCE_LABEL[b.selectedSource] || b.selectedSource,
    sourceUrl: b.selectedPriceUrl,
    retrievedAt: b.priceRetrievedAt,
  };

  return {
    id: b.id,
    name: b.name,
    address: b.address || 'Chưa có địa chỉ',

    district: b.district,
    districtLabel: districtVi(b.district),
    legacyDistrict: b.legacyDistrict || b.district,
    legacyDistrictLabel: b.legacyDistrict || b.district,
    legacyDistrictSemantics: b.legacyDistrictSemantics,
    currentWard: b.currentWard,
    currentWardOsmId: b.currentWardOsmId,
    currentWardMatchMethod: b.currentWardMatchMethod,
    currentWardAddressLabel: b.currentWardAddressLabel,
    currentWardAddressAgrees: b.currentWardAddressAgrees,
    currentWardAddressStatus: b.currentWardAddressStatus,
    currentWardBoundaryDistanceM: b.currentWardBoundaryDistanceM,
    currentWardNearBoundary: b.currentWardNearBoundary,
    currentWardAsOf: b.currentWardAsOf,
    currentWardNeedsReview: !!b.currentWardNeedsReview,
    currentWardNote: b.currentWardNote,
    submarket: b.submarket,
    submarketLabel: SUBMARKET_LABEL[b.submarket] || b.submarket,

    // Hạng: luôn kèm "theo nguồn" — không phải chuẩn pháp lý toàn thị trường.
    grade: b.grade,
    gradeLabel: b.gradeRaw,
    gradeOrder: GRADE_ORDER[b.grade] ?? 99,
    gradeField: field(b.gradeRaw, { ...srcMeta, definition: 'Hạng tòa nhà theo nguồn dữ liệu' }),

    // ---- Giá: ba đại lượng KHÁC ĐỊNH NGHĨA, không bao giờ trộn -----------
    baseRent: field(b.baseRent, { ...srcMeta, unit: 'USD/m²/tháng', raw: b.rentRaw, definition: NHAN.dinhNghiaGia }),
    // Phiên bản đầy đủ (01/10): giá niêm yết 03/2026 của 407 tòa giữ riêng, không vào thang giá chào.
    giaNiemYet407: field(b.giaNiemYet407 ?? null, { unit: 'USD/m²/tháng', definition: 'Giá niêm yết tháng 03/2026, gồm phí dịch vụ, chưa VAT.' }),
    laToa407: b.laToa407 !== false,
    toaDoGoogle: !!b.toaDoGoogle,
    hetHanToaDo: b.hetHanToaDo || null,
    // 407 tòa trong bản đầy đủ: ghim trang rao (Google); tọa độ bền giữ ở đây để vẫn vẽ được khi Google hỏng (02/10)
    toaDoBen: Array.isArray(b.toaDoBen) ? b.toaDoBen : null,
    toaDoBenNguon: b.toaDoBenNguon || null,
    lechToaDoBenM: b.lechToaDoBenM ?? null,
    ghimNghi: b.ghimNghi || null,
    tenKhac: b.tenKhac || null,
    baseRentMin: field(b.baseRentMin, { ...srcMeta, unit: 'USD/m²/tháng', raw: b.rentRaw }),
    baseRentMax: field(b.baseRentMax, { ...srcMeta, unit: 'USD/m²/tháng', raw: b.rentRaw }),
    serviceCharge: field(b.serviceCharge, { ...srcMeta, unit: 'USD/m²/tháng', raw: b.serviceChargeRaw, definition: 'Phí dịch vụ do nguồn niêm yết công bố.' }),
    grossExVat: field(b.grossExVat, { ...srcMeta, unit: 'USD/m²/tháng', definition: 'Giá thuê cơ bản cộng phí dịch vụ, chưa gồm VAT.' }),
    grossIncVat: field(b.grossIncVat, { ...srcMeta, unit: 'USD/m²/tháng', raw: b.vatRaw, definition: 'Tổng gồm VAT = tổng trước VAT × (1 + thuế suất do nguồn công bố).' }),
    vatRaw: b.vatRaw,

    // Diện tích trống: 12/12 tòa CHƯA có trong bản thử. Trạng thái hạng nhất.
    availableArea: field(b.availableAreaMinM2, { ...srcMeta, unit: 'm²', raw: b.availableAreaRaw }),

    teacherNo: b.teacherNo,
    nameOriginal: b.nameOriginal,
    knownAliases: b.knownAliases || [],
    nameChangeNote: b.nameChangeNote,
    rentReferencePeriod: b.rentReferencePeriod,
    nla: field(b.nlaM2, { unit: 'm²', sourceName: 'Bộ dữ liệu 03/2026', definition: 'Diện tích cho thuê thực (NLA).' }),
    occupancy: field(b.occupancyPct, { unit: '%', sourceName: 'Bộ dữ liệu 03/2026', definition: 'Tỷ lệ lấp đầy tháng 03/2026.' }),

    // ---- Vị trí: chỉ dùng toạ độ trong payload, không thay đổi -----------
    lat: b.latitude,
    lng: b.longitude,
    coordinateSource: b.coordinateSource,
    coordinateStatus: b.coordinateStatus,
    coordinateVerified: b.coordinateVerified,
    entityReviewStatus: b.entityReviewStatus,
    releaseLimitation: b.releaseLimitation,
    manualReviewReason: b.manualReviewReason,
    selectedPlaceId: b.selectedPlaceId,
    selectedPlaceName: b.selectedPlaceName,
    selectedPlaceAddress: b.selectedPlaceAddress,
    identitySourceDomains: b.identitySourceDomains || [],
    identitySourceUrls: b.identitySourceUrls || [],
    googleMapsCoordinateUrl: b.googleMapsCoordinateUrl,
    googleMapsSatelliteUrl: b.googleMapsSatelliteUrl,
    duplicateOfTeacherNo: b.duplicateOfTeacherNo,
    relationshipNote: b.relationshipNote,

    nearestMetro: metroVi(b.nearestMetro),
    distanceMetro: field(b.distanceMetroM, { unit: 'm', definition: 'Khoảng cách đường thẳng tới ga gần nhất' }),
    distanceCbd: field(b.distanceCbdM, { unit: 'm', definition: 'Khoảng cách đường thẳng tới trung tâm (UBND Thành phố)' }),
    distanceAirport: field(b.distanceAirportM, { unit: 'm', definition: 'Khoảng cách đường thẳng tới sân bay Tân Sơn Nhất' }),
    metroWalkingDistance: field(b.metroWalkingDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Quãng đường đi bộ tới ga metro gần nhất' }),
    metroWalkingDuration: field(b.metroWalkingDurationS, { unit: 's', definition: 'Thời gian đi bộ tới ga metro gần nhất' }),
    cbdDrivingDistance: field(b.cbdDrivingDistanceM, { unit: 'm', definition: 'Quãng đường lái xe tới trung tâm' }),
    cbdDrivingDurationStatic: field(b.cbdDrivingDurationStaticS, { unit: 's', definition: 'Thời gian lái xe tới trung tâm, chưa tính kẹt xe' }),
    airportDrivingDistance: field(b.airportDrivingDistanceM, { unit: 'm', definition: 'Quãng đường lái xe tới sân bay' }),
    airportDrivingDurationStatic: field(b.airportDrivingDurationStaticS, { unit: 's', definition: 'Thời gian lái xe tới sân bay, chưa tính kẹt xe' }),
    trafficObservationDate: b.trafficObservationDate,
    traffic: Array.isArray(b.trafficSnapshots) ? b.trafficSnapshots : [],

    // ---- Biến nghiên cứu V9 R5: một construct, một biến chính -----------
    researchSpatial: {
      releaseId: r5.releaseId,
      analysisEntityId: r5.analysisEntityId,
      representativeTeacherNo: r5.representativeTeacherNo,
      crosswalkMappingType: r5.crosswalkMappingType,
      featureReleaseStatus: r5.featureReleaseStatus,
      observationSemantics: r5.observationSemantics,
      qaStatus: r5.qaStatus,
      qaFlags: r5.qaFlags,
      networkSnapDistance: field(r5.networkSnapDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Khoảng cách từ tòa nhà tới điểm gần nhất trên mạng đường đi bộ' }),
      networkSnapPolicy: r5.networkSnapPolicy,
      hospitalDistance: field(r5Hospital.releaseDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Quãng đi bộ tới bệnh viện có điều trị nội trú gần nhất', note: r5Hospital.routeReleaseStatus }),
      hospitalOpenNetworkDistance: field(r5Hospital.openNetworkDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Quãng đi bộ tới bệnh viện gần nhất, số đối chiếu' }),
      hospitalName: r5Hospital.name,
      hospitalCanonicalId: r5Hospital.canonicalId,
      hospitalGeodesicSupport: field(r5Hospital.geodesicSupportM, { unit: 'm', definition: 'Khoảng cách đường thẳng tới bệnh viện gần nhất' }),
      hospitalEvidenceStatus: r5Hospital.evidenceStatus,
      hospitalRouteReleaseStatus: r5Hospital.routeReleaseStatus,
      publicGreenShare: field(r5Green.publicAreaShare800M, { unit: 'tỷ lệ', sourceName: 'OpenStreetMap, Overture', definition: 'Tỷ lệ diện tích cây xanh công cộng trong bán kính 800 m' }),
      publicGreenArea: field(r5Green.publicAreaM2800M, { unit: 'm²', sourceName: 'OpenStreetMap, Overture', definition: 'Diện tích cây xanh công cộng trong bán kính 800 m' }),
      metroDistance: field(r5Metro.releaseDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Quãng đi bộ tới ga metro gần nhất', note: r5Metro.routeReleaseStatus }),
      metroOpenNetworkDistance: field(r5Metro.openNetworkDistanceM, { unit: 'm', sourceName: 'OpenStreetMap', definition: 'Quãng đi bộ tới ga metro gần nhất, số đối chiếu' }),
      metroStationName: r5Metro.stationName,
      metroStationRef: r5Metro.stationRef,
      metroGeodesicSupport: field(r5Metro.geodesicSupportM, { unit: 'm', definition: 'Khoảng cách đường thẳng tới ga metro gần nhất' }),
      metroRouteReleaseStatus: r5Metro.routeReleaseStatus,
      busStopClusters: field(r5.busStopClusterCount800M, { unit: 'cụm', sourceName: 'OpenStreetMap, Overture', definition: 'Số cụm trạm xe buýt trong bán kính 800 m' }),
      intersectionDensity: field(r5.intersectionDensity800M, { unit: 'giao lộ/km²', sourceName: 'OpenStreetMap', definition: 'Mật độ giao lộ trong bán kính 800 m' }),
      dailyDestinationDensity: field(r5.dailyDestinationDensity800M, { unit: 'điểm/km²', sourceName: 'OpenStreetMap, Overture', definition: 'Mật độ cửa hàng thực phẩm và bán lẻ trong bán kính 800 m' }),
      amenityMixShannon: field(r5.amenityMixShannon800M, { unit: 'chỉ số', sourceName: 'OpenStreetMap, Overture', definition: 'Độ đa dạng tiện ích hằng ngày (chỉ số Shannon)' }),
      neighboringOfficeNla: field(r5.neighboringOfficeNla1000M, { unit: 'm²', sourceName: 'Bộ dữ liệu 03/2026', definition: 'Tổng diện tích văn phòng cho thuê trong bán kính 1 km' }),
      warehouseCounts: r5.warehouseCounts || {},
    },

    // ---- Thông số tòa nhà: hiển thị đúng như nguồn ghi -------------------
    completionYear: field(b.completionYear, srcMeta),
    floors: field(b.floors, { ...srcMeta, unit: 'tầng' }),
    basements: field(b.basements, { ...srcMeta, unit: 'hầm' }),
    elevators: field(b.elevators, { ...srcMeta, unit: 'thang' }),
    floorPlateM2: field(b.floorPlateM2, { ...srcMeta, unit: 'm²/sàn' }),

    // ---- Chất lượng và đối chiếu ----------------------------------------
    crosscheck: CROSSCHECK_LABEL[b.priceCrosscheckStatus] || { text: b.priceCrosscheckStatus, tone: 'missing' },
    crosscheckRaw: b.priceCrosscheckStatus,
    baseRentRelativeGap: b.baseRentRelativeGap,
    selectedSourceKey: b.selectedSource,
    sourceCount: sources.length,

    sources: sources.map((s) => ({
      key: s.source,
      label: SOURCE_LABEL[s.source] || s.source,
      title: s.title,
      url: s.url,
      retrievedAt: s.retrievedAt,
      rentRaw: s.rentRaw,
      baseRent: s.baseRent ?? null,
      rentMin: s.rentMin ?? null,
      rentMax: s.rentMax ?? null,
      serviceChargeRaw: s.serviceChargeRaw,
      serviceCharge: s.serviceCharge ?? null,
      vatRaw: s.vatRaw,
      grossExVat: s.grossExVat ?? null,
      status: s.status,
      statusLabel: SOURCE_STATUS_LABEL[s.status] || s.status,
      parseConfidence: s.parseConfidence,
      selected: !!s.selected,
      publishesPrice: s.status !== 'EXCLUDE_NO_PUBLIC_BASE_RENT',
    })),

    // Dải hai nguồn: chỉ dựng khi CẢ HAI nguồn công bố tổng trước VAT.
    sourceBand: sourceBand(b.sources),

    // ---- Ảnh: giữ nguyên nguồn và ghi chú quyền -------------------------
    image: e.image
      ? {
          localUrl: e.image.localUrl,
          sourceImageUrl: e.image.sourceImageUrl,
          sourcePageUrl: e.image.sourcePageUrl,
          rightsNote: e.image.rightsNote,
          attribution: e.image.attribution,
          status: e.image.status,
        }
      : null,

    // ---- Tiện ích: dữ liệu Google Places → KHÔNG lên bản đồ -------------
    amenityMethod: e.amenityMethod || null,
    amenities: AMENITY_GROUPS.map((g) => {
      const list = (e.amenities && e.amenities[g.key]) || [];
      return {
        ...g,
        // Mảng rỗng KHÔNG phải "chưa thu thập": đã tìm theo phương pháp đã nêu
        // và không có kết quả nào đạt ngưỡng. Hai trạng thái khác nhau.
        state: e.amenities && Object.prototype.hasOwnProperty.call(e.amenities, g.key)
          ? (list.length ? FieldState.PRESENT : FieldState.ZERO_OBSERVED)
          : FieldState.NOT_COLLECTED,
        places: list.map((p) => ({
          placeId: p.placeId,
          name: p.name,
          address: p.address,
          primaryType: p.primaryType,
          rating: p.rating ?? null,
          reviewCount: p.reviewCount ?? null,
          distanceM: p.distanceM ?? null,
          walkingDistanceM: p.walkingDistanceM ?? null,
          walkingDurationS: p.walkingDurationS ?? null,
          distanceSemantics: p.distanceSemantics ?? null,
          selectionMethod: p.selectionMethod ?? null,
          googleMapsUri: p.googleMapsUri,
          businessStatus: p.businessStatus,
          operational: p.businessStatus === 'OPERATIONAL',
        })),
      };
    }),

    // Do payload sinh sẵn; giữ nguyên văn, không diễn giải thêm.
    transparentStrengths: e.transparentStrengths || [],

    _payloadGeneratedAt: payload.generatedAt,
  };
}

function sourceBand(sources) {
  const withPrice = sources.filter((s) => typeof s.grossExVat === 'number');
  if (withPrice.length < 2) return null;
  const values = withPrice.map((s) => s.grossExVat);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  return {
    low: lo,
    high: hi,
    spreadPct: lo > 0 ? ((hi - lo) / lo) * 100 : null,
    entries: withPrice.map((s) => ({
      key: s.source, label: SOURCE_LABEL[s.source] || s.source,
      grossExVat: s.grossExVat, retrievedAt: s.retrievedAt, url: s.url, selected: !!s.selected,
    })),
  };
}

/* ---------------------------------------------------------------------------
   Lọc và sắp xếp. Mọi phép so sánh chỉ diễn ra TRONG tập 12 tòa của bản thử;
   không có phép tính nào ngụ ý toàn thị trường.
   ------------------------------------------------------------------------ */

export const defaultFilters = () => ({
  query: '',
  grades: new Set(),
  submarkets: new Set(),
  legacyDistricts: new Set(),
  currentWards: new Set(),
  metroMax: null,          // mét, đường thẳng
  rentMax: null,           // USD/m²/tháng, giá thuê cơ bản
  onlyTwoSourcePrice: false,
});

export function filterBuildings(buildings, f) {
  const q = f.query.trim().toLowerCase();
  return buildings.filter((b) => {
    if (q) {
      const hay = (b.name + ' ' + b.address + ' ' + b.legacyDistrictLabel + ' ' + (b.currentWard || '') + ' ' + b.id).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.grades.size && !f.grades.has(b.grade)) return false;
    if (f.submarkets.size && !f.submarkets.has(b.submarket)) return false;
    if (f.legacyDistricts.size && !f.legacyDistricts.has(b.legacyDistrict)) return false;
    if (f.currentWards.size && !f.currentWards.has(b.currentWard)) return false;
    if (f.metroMax != null && isPresent(b.distanceMetro) && b.distanceMetro.value > f.metroMax) return false;
    if (f.rentMax != null && isPresent(b.baseRent) && b.baseRent.value > f.rentMax) return false;
    // Number(null) là 0: phải loại null trước, nếu không bộ lọc "Chỉ tòa đã có tọa độ" giữ cả 7 tòa chưa có tọa độ.
    if (f.onlyTwoSourcePrice && !(b.lat != null && b.lng != null && Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)))) return false;
    return true;
  });
}

/* Thiếu giá/khoảng cách thì xếp CUỐI ở mọi chiều (phiên bản đầy đủ có tòa ghi "liên hệ"; null - số = NaN làm sắp lộn xộn). */
const soSanh = (x, y, chieu = 1) => {
  const a = Number.isFinite(x) ? x : null, b = Number.isFinite(y) ? y : null;
  if (a == null || b == null) return (a == null) - (b == null);
  return chieu * (a - b);
};
export const SORTS = {
  rent_asc: { label: 'Giá thuê thấp → cao', cmp: (a, b) => soSanh(a.baseRent.value, b.baseRent.value) },
  rent_desc: { label: 'Giá thuê cao → thấp', cmp: (a, b) => soSanh(a.baseRent.value, b.baseRent.value, -1) },
  metro_asc: { label: 'Gần ga metro nhất', cmp: (a, b) => soSanh(a.distanceMetro.value, b.distanceMetro.value) },
  grade_asc: { label: 'Hạng tòa nhà', cmp: (a, b) => a.gradeOrder - b.gradeOrder || soSanh(a.baseRent.value, b.baseRent.value) },
  spread_desc: { label: 'Hai nguồn lệch nhiều nhất', cmp: (a, b) => (b.sourceBand?.spreadPct ?? -1) - (a.sourceBand?.spreadPct ?? -1) },
};

export function activeFilterCount(f) {
  let n = 0;
  if (f.query.trim()) n++;
  if (f.grades.size) n++;
  if (f.submarkets.size) n++;
  if (f.legacyDistricts.size) n++;
  if (f.currentWards.size) n++;
  if (f.metroMax != null) n++;
  if (f.rentMax != null) n++;
  if (f.onlyTwoSourcePrice) n++;
  return n;
}
