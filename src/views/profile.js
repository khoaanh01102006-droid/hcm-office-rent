/* Trang chi tiết một tòa nhà. Chữ theo nang_cap/06_QUY_UOC_VIET_PI.md: nhãn ngắn, không lộ mã nội bộ
   (trạng thái tọa độ, mã QA, STT). Mã gốc vẫn nằm trong dữ liệu để truy vết, chỉ không hiện ra. */

import { icon } from '../icons.js';
import { isPresent, FieldState } from '../data.js';
import { money, distance, dateTime, num, percent } from '../format.js';
import { esc, missingChip, gradeBadge } from '../components/primitives.js';

const windowLabel = { morning: '08:00', midday: '13:30', evening: '17:30' };
const destinationLabel = { cbd: 'Trung tâm (UBND Thành phố)', airport: 'Sân bay Tân Sơn Nhất' };

// Cách xác định tọa độ, viết lại cho người đọc từ mã trạng thái trong dữ liệu.
export const COORD_METHOD = {
  PUBLISHED_GOOGLE_PLACE_IDENTITY: 'Vị trí Google Maps khớp tên và địa chỉ',
  PUBLISHED_V8_REVIEWED_GOOGLE_PLACE: 'Vị trí Google Maps khớp tên và địa chỉ',
  PUBLISHED_BROKER_PLACE_ADDRESS_CORROBORATED: 'Vị trí do trang môi giới đặt, khớp địa chỉ',
  PUBLISHED_V8_BROKER_NAMED_GOOGLE_PLACE: 'Vị trí do trang môi giới đặt, khớp địa chỉ',
  PUBLISHED_TEACHER_REVIEWED: 'Đã kiểm tra thủ công',
  PUBLISHED_V8_QA_PASS: 'Đã kiểm tra thủ công',
  PUBLISHED_V8_ADDRESS_GEOCODE_LIMITED: 'Điểm theo địa chỉ',
  PUBLISHED_ADDRESS_POINT_LIMITED: 'Điểm theo địa chỉ',
  PUBLISHED_V8_DUPLICATE_ROW_COORDINATE_SHARED: 'Dùng chung vị trí với cùng tòa nhà',
  AUDIT_20261001_TEACHER_FILE: 'Kiểm lại 01/10/2026: theo tọa độ bộ dữ liệu, trùng trang rao của chính tòa',
  AUDIT_20261001_LISTING_PAGE: 'Kiểm lại 01/10/2026: theo bản đồ trên trang rao của chính tòa',
  AUDIT_20261001_ADDRESS_ONLY: 'Kiểm lại địa chỉ 01/10/2026; tọa độ giữ nguyên',
  HOLD_V8_MANUAL_REVIEW: 'Chưa xác định',
};

const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

const ghimUrl = (ten, placeId) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ten || 'office')}&query_place_id=${encodeURIComponent(placeId)}`;
const so1 = (v) => (v == null ? '—' : money(v));

export function renderProfile(b, data, _osm, giaNguon) {
  const g = giaNguon?.toa?.[b.id] || null;
  return `<div class="pf">
    ${hero(b)}
    ${priceSourcesBlock(b, g)}
    ${leaseBlock(b)}
    ${locationBlock(b, g)}
    ${surroundBlock(b)}
    ${trafficBlock(b)}
    ${evidenceBlock(b, data)}
  </div>`;
}

function hero(b) {
  const listingUrl = b.sources.find((source) => source.selected && source.url)?.url;
  const imgSrc = b.image?.sourcePageUrl;
  return `<section class="pf__hero">
    ${b.image
      ? `<figure class="pf__fig">
          <img src="${esc(b.image.localUrl)}" alt="Ảnh tòa nhà ${esc(b.name)}" loading="lazy">
          ${imgSrc ? `<figcaption>${icon('image', { size: 12 })}<span>Ảnh:</span>
            <a href="${esc(imgSrc)}" target="_blank" rel="noopener noreferrer">${esc(host(imgSrc))} ${icon('external', { size: 11 })}</a>
          </figcaption>` : ''}
        </figure>`
      : `<div class="pf__fig pf__fig--none">${missingChip(FieldState.NOT_COLLECTED, 'Chưa có ảnh cho tòa này.', 'Chưa có ảnh')}</div>`}
    <div class="pf__ident">
      <div class="pf__badges">${gradeBadge(b)} <span class="badge badge--muted">${esc(b.submarketLabel)}</span></div>
      <h3 class="pf__name">${esc(b.name)}</h3>
      ${b.nameOriginal && b.nameOriginal !== b.name ? `<p class="pf__addr">Tên khác: ${esc(b.nameOriginal)}</p>` : ''}
      <p class="pf__addr">${esc(b.address)}</p>
      <div class="pf__cta">
        <button class="btn btn--outline" type="button" data-act="compare" data-id="${esc(b.id)}" aria-pressed="false">
          ${icon('scale', { size: 13 })} Thêm vào so sánh
        </button>
        ${b.googleMapsCoordinateUrl ? `<a class="btn btn--outline" href="${esc(b.googleMapsCoordinateUrl)}" target="_blank" rel="noopener noreferrer">Google Maps ${icon('external', { size: 13 })}</a>` : ''}
        ${listingUrl ? `<a class="btn btn--outline" href="${esc(listingUrl)}" target="_blank" rel="noopener noreferrer">Trang nguồn ${icon('external', { size: 13 })}</a>` : ''}
      </div>
    </div>
  </section>`;
}

/* GIÁ THEO NGUỒN VÀ THỜI ĐIỂM (chủ dự án 01/10): bộ dữ liệu 03/2026 + mỗi trang rao của chính tòa ở mỗi lần thu.
   Số lớn là TRUNG VỊ các mức giá cùng cơ sở (gồm phí dịch vụ, chưa VAT), kèm khoảng thấp nhất - cao nhất. Trang rao ghi giá
   theo khoảng thì so bằng điểm giữa; trang không ghi phí dịch vụ vẫn hiện nhưng không vào trung vị. Dữ liệu: n32_gia_nhieu_nguon.py. */
function priceSourcesBlock(b, g) {
  const tom = g?.tom;
  const dong = g?.dong || [];
  const coTrang = dong.some((d) => d.url);
  const coTrangKhongGia = !coTrang && (g?.trang || []).length > 0;
  const hang = dong.map((d) => `<tr class="${d.url ? '' : 'is-thay'}">
      <td>${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.nguon)}</a>` : esc(d.nguon)}
        ${d.ten_tren_trang ? `<small>${esc(d.ten_tren_trang)}</small>` : ''}</td>
      <td>${esc(d.thoi_diem)}</td>
      <td class="n">${d.url ? `${esc(String(d.co_ban).replace(/\./g, ','))}<small>${d.phi_dv == null ? 'chưa ghi phí' : `+ phí ${esc(so1(d.phi_dv))}`}</small>` : '<small>gồm phí</small>'}</td>
      <td class="n"><strong>${esc(so1(d.gom_phi))}</strong></td>
      <td class="n">${d.place_id ? `<a href="${esc(ghimUrl(d.ten_tren_trang, d.place_id))}" target="_blank" rel="noopener noreferrer" title="Ghim của trang rao trên Google Maps">Ghim ${icon('external', { size: 10 })}</a>` : ''}</td>
    </tr>`).join('');
  return `<section class="pf__sec">
    <div class="pf__sechead"><h4>${icon('file', { size: 15 })} Giá thuê theo nguồn</h4>
      <span class="pf__srcnote">USD/m²/tháng, chưa VAT</span></div>
    <div class="pf__pricegrid">
      <div class="pricerow is-strong">
        <div class="pricerow__label"><span>${tom && tom.n > 1 ? 'Trung vị các nguồn' : 'Giá niêm yết 03/2026'}</span>
          <em>${tom && tom.n > 1 ? `từ ${esc(so1(tom.thap))} đến ${esc(so1(tom.cao))} · ${tom.n} mức giá gồm phí dịch vụ` : 'gồm phí dịch vụ, chưa VAT'}</em></div>
        <div class="pricerow__val">${tom ? `<strong>${esc(so1(tom.trung_vi))}</strong><span class="pricerow__unit">USD/m²/tháng</span>`
    : (isPresent(b.baseRent) ? `<strong>${esc(money(b.baseRent.value))}</strong><span class="pricerow__unit">USD/m²/tháng</span>` : missingChip(b.baseRent.state))}</div>
      </div>
    </div>
    ${dong.length ? `<table class="pf__gia">
      <caption class="sr-only">Giá thuê của ${esc(b.name)} theo nguồn và thời điểm</caption>
      <thead><tr><th scope="col">Nguồn</th><th scope="col">Thời điểm</th><th scope="col" class="n">Giá cơ bản</th>
        <th scope="col" class="n">Gồm phí</th><th scope="col" class="n"></th></tr></thead>
      <tbody>${hang}</tbody></table>` : ''}
    <p class="pf__note">${coTrang
    ? 'Bộ dữ liệu 03/2026 ghi giá niêm yết đã gồm phí dịch vụ; trang rao ghi giá cơ bản và phí dịch vụ riêng, giá theo khoảng thì lấy điểm giữa. Trung vị chỉ tính các mức giá có phí dịch vụ.'
    : coTrangKhongGia ? 'Trang rao của tòa này không ghi giá (liên hệ).'
      : 'Chưa tìm thấy trang rao của tòa này trên Maison Office và Saigon Office.'}</p>
  </section>`;
}

function leaseBlock(b) {
  return `<section class="pf__sec">
    <div class="pf__sechead"><h4>${icon('layers', { size: 15 })} Thông tin tòa nhà 03/2026</h4>
      <span class="pf__srcnote">Bộ dữ liệu 03/2026</span></div>
    <div class="pf__pricegrid">
      <div class="pricerow">
        <div class="pricerow__label"><span>Tỷ lệ lấp đầy</span></div>
        <div class="pricerow__val">${isPresent(b.occupancy) ? `<strong>${esc(num(b.occupancy.value, 1, 1))}</strong><span class="pricerow__unit">%</span>` : missingChip(b.occupancy.state)}</div>
      </div>
      <div class="pricerow">
        <div class="pricerow__label"><span>Diện tích cho thuê</span><em>NLA</em></div>
        <div class="pricerow__val">${isPresent(b.nla) ? `<strong>${esc(num(b.nla.value))}</strong><span class="pricerow__unit">m²</span>` : missingChip(b.nla.state)}</div>
      </div>
      <div class="pricerow">
        <div class="pricerow__label"><span>Hạng tòa nhà</span></div>
        <div class="pricerow__val"><strong>${esc(b.gradeLabel)}</strong></div>
      </div>
    </div>
  </section>`;
}

function locationBlock(b, g) {
  const trang = (g?.trang || []).filter((t) => t.place_id);
  const hasCoordinate = Number.isFinite(b.lat) && Number.isFinite(b.lng);
  const straight = [
    { f: b.distanceMetro, label: `Ga metro gần nhất${b.nearestMetro ? ` (${b.nearestMetro})` : ''}`, ic: 'train' },
    { f: b.distanceCbd, label: 'Trung tâm (UBND Thành phố)', ic: 'target' },
    { f: b.distanceAirport, label: 'Sân bay Tân Sơn Nhất', ic: 'map' },
  ];
  const routes = [
    { distance: b.metroWalkingDistance, duration: b.metroWalkingDuration, label: 'Đi bộ tới ga metro', ic: 'train' },
    { distance: b.cbdDrivingDistance, duration: b.cbdDrivingDurationStatic, label: 'Lái xe tới trung tâm, không tính kẹt xe', ic: 'target' },
    { distance: b.airportDrivingDistance, duration: b.airportDrivingDurationStatic, label: 'Lái xe tới sân bay, không tính kẹt xe', ic: 'map' },
  ].filter((r) => isPresent(r.distance) || r.ic === 'train');
  return `<section class="pf__sec">
    <div class="pf__sechead"><h4>${icon('map', { size: 15 })} Vị trí</h4></div>
    <ul class="pf__dist">
      ${straight.map((item) => `<li><span class="pf__distic">${icon(item.ic, { size: 14 })}</span><span class="pf__distlabel">${esc(item.label)}, đường thẳng</span><span class="pf__distval">${isPresent(item.f) ? esc(distance(item.f.value)) : missingChip(item.f.state)}</span></li>`).join('')}
      ${routes.map((item) => `<li><span class="pf__distic">${icon(item.ic, { size: 14 })}</span><span class="pf__distlabel">${esc(item.label)}</span><span class="pf__distval">${isPresent(item.distance) ? `${esc(distance(item.distance.value))}${isPresent(item.duration) ? ` · ${esc(duration(item.duration.value))}` : ''}` : missingChip(item.distance.state)}</span></li>`).join('')}
    </ul>
    <details class="pf__more" ${hasCoordinate ? '' : 'open'}>
      <summary>Tọa độ</summary>
      <dl class="pf__dl">
        <dt>Tọa độ</dt><dd>${hasCoordinate ? `<code>${b.lat.toFixed(6)}, ${b.lng.toFixed(6)}</code>` : missingChip(FieldState.NOT_COLLECTED, 'Chưa đủ căn cứ để đặt vị trí.', 'Chưa có')}</dd>
        <dt>Cách xác định</dt><dd>${esc(COORD_METHOD[b.coordinateStatus] || 'Theo nguồn dữ liệu')}</dd>
        ${b.selectedPlaceName ? `<dt>Địa điểm Google Maps</dt><dd>${esc(b.selectedPlaceName)}<br><small>${esc(b.selectedPlaceAddress || '')}</small></dd>` : ''}
      </dl>
    </details>
    ${trang.length ? `<div class="pf__ghimwrap"><p class="pf__note">Ghim của tòa trên các trang rao, mở trên Google Maps để đối chiếu:</p>
      <ul class="pf__ghim">${trang.map((t) => `<li><span>${esc(t.nguon)} · ${esc(t.ten)}<small>${esc(t.dia_chi)}</small></span>
        <a href="${esc(ghimUrl(t.ten, t.place_id))}" target="_blank" rel="noopener noreferrer">Xem ghim ${icon('external', { size: 11 })}</a></li>`).join('')}</ul></div>` : ''}
  </section>`;
}

function surroundBlock(b) {
  const r = b.researchSpatial || {};
  const routeValue = (f, status) => {
    if (isPresent(f)) return `<strong>${esc(distance(f.value))}</strong>`;
    if (status === 'MISSING_AFTER_3_ATTEMPTS') {
      return missingChip(FieldState.NOT_COLLECTED, 'Các nguồn đo cho kết quả khác nhau nên để trống.', 'Chưa xác định');
    }
    return missingChip(f?.state || FieldState.NOT_COLLECTED);
  };
  const row = (label, definition, value) => `<div class="pricerow">
    <div class="pricerow__label"><span>${esc(label)}</span>${definition ? `<em>${esc(definition)}</em>` : ''}</div>
    <div class="pricerow__val">${value}</div>
  </div>`;
  const val = (f, digits, unit) => (isPresent(f)
    ? `<strong>${esc(num(f.value, digits, digits))}</strong>${unit ? `<span class="pricerow__unit">${esc(unit)}</span>` : ''}`
    : missingChip(f?.state));
  const green = isPresent(r.publicGreenShare)
    ? `<strong>${esc(percent(r.publicGreenShare.value * 100, 1))}</strong>`
    : missingChip(r.publicGreenShare?.state);

  // Toà vừa dời toạ độ sau đợt kiểm 01/10 chưa có số đo mới: ẩn cả khối thay vì một cột "chưa thu thập".
  const coSo = [r.hospitalDistance, r.metroDistance, r.publicGreenShare, r.busStopClusters, r.intersectionDensity,
    r.dailyDestinationDensity, r.amenityMixShannon, r.neighboringOfficeNla].some((f) => isPresent(f));
  if (!coSo) return '';
  return `<section class="pf__sec pf__sec--research">
    <div class="pf__sechead"><h4>${icon('layers', { size: 15 })} Khu vực xung quanh</h4>
      <span class="pf__srcnote">OpenStreetMap, Overture</span></div>
    <div class="pf__pricegrid">
      ${row(`Bệnh viện gần nhất${r.hospitalName ? ` (${r.hospitalName})` : ''}`, 'quãng đi bộ', routeValue(r.hospitalDistance, r.hospitalRouteReleaseStatus))}
      ${row(`Ga metro${r.metroStationName ? ` (${r.metroStationName})` : ''}`, 'quãng đi bộ', routeValue(r.metroDistance, r.metroRouteReleaseStatus))}
      ${row('Cây xanh công cộng', 'tỷ lệ diện tích trong 800 m', green)}
      ${row('Trạm xe buýt', 'số cụm trạm trong 800 m', val(r.busStopClusters, 0, 'cụm'))}
      ${row('Mật độ giao lộ', 'trong 800 m', val(r.intersectionDensity, 1, 'giao lộ/km²'))}
      ${row('Cửa hàng hằng ngày', 'thực phẩm và bán lẻ trong 800 m', val(r.dailyDestinationDensity, 1, 'điểm/km²'))}
      ${row('Độ đa dạng tiện ích', 'chỉ số Shannon', val(r.amenityMixShannon, 2, ''))}
      ${row('Văn phòng lân cận', 'tổng diện tích cho thuê trong 1 km', val(r.neighboringOfficeNla, 0, 'm²'))}
    </div>
  </section>`;
}

/* Lái xe có xét giao thông. Dữ liệu ghi ba mốc 08:00, 13:30, 17:30 nhưng cả ba là cùng một lần gọi lúc
   08:04 (0/800 cặp khác nhau), nên khi ba mốc trùng nhau thì chỉ hiện một số. Nếu sau này thu đúng
   theo giờ, khối này tự hiện lại đủ ba mốc. */
function trafficBlock(b) {
  if (!b.traffic.length) {
    return `<section class="pf__sec"><div class="pf__sechead"><h4>${icon('clock', { size: 15 })} Lái xe có xét giao thông</h4></div>${missingChip(FieldState.NOT_COLLECTED, 'Chưa có tọa độ nên chưa tính được.')}</section>`;
  }
  const groups = ['cbd', 'airport'].map((destinationId) => {
    const items = b.traffic.filter((item) => item.destinationId === destinationId);
    return { destinationId, item: items[0] };
  }).filter((g) => g.item);

  const sameAcrossWindows = ['cbd', 'airport'].every((d) => {
    const set = new Set(b.traffic.filter((x) => x.destinationId === d).map((x) => x.durationTrafficS));
    return set.size <= 1;
  });

  const ratio = (x) => (x.congestionRatio != null ? ` · chậm hơn ${esc(num(x.congestionRatio, 2, 2))} lần` : '');
  const one = (g) => `<article class="srccard">
    <header><span class="srccard__name">${esc(destinationLabel[g.destinationId])}</span></header>
    <dl class="pf__dl pf__dl--tight">
      <dt>Có giao thông</dt>
      <dd><strong>${esc(duration(g.item.durationTrafficS))}</strong> · ${esc(distance(g.item.distanceM))}</dd>
      ${g.item.durationStaticS != null ? `<dt>Không kẹt xe</dt>
      <dd>${esc(duration(g.item.durationStaticS))}${ratio(g.item)}</dd>` : ''}
    </dl></article>`;

  const all = (g) => `<article class="srccard">
    <header><span class="srccard__name">${esc(destinationLabel[g.destinationId])}</span></header>
    <dl class="pf__dl pf__dl--tight">
      ${b.traffic.filter((x) => x.destinationId === g.destinationId).map((item) => `<dt>${esc(windowLabel[item.windowLabel] || item.scheduledTimeLocal)}</dt><dd><strong>${esc(duration(item.durationTrafficS))}</strong> · ${esc(distance(item.distanceM))}${item.durationStaticS != null ? `<br><small>không kẹt xe: ${esc(duration(item.durationStaticS))}${ratio(item)}</small>` : ''}</dd>`).join('')}
    </dl></article>`;

  return `<section class="pf__sec">
    <div class="pf__sechead"><h4>${icon('clock', { size: 15 })} Lái xe có xét giao thông</h4><span class="pf__srcnote">Google Routes</span></div>
    <p class="pf__note">${sameAcrossWindows
    ? `Một lần đo lúc 08:04 ngày ${esc(b.trafficObservationDate)}.`
    : `Đo ngày ${esc(b.trafficObservationDate)} lúc 08:00, 13:30 và 17:30.`}</p>
    <div class="srcgrid">${groups.map(sameAcrossWindows ? one : all).join('')}</div>
  </section>`;
}

function evidenceBlock(b, data) {
  const links = b.identitySourceUrls || [];
  return `<section class="pf__sec pf__sec--evidence">
    <div class="pf__sechead"><h4>${icon('info', { size: 15 })} Tên gọi và nguồn</h4></div>
    <dl class="pf__dl">
      <dt>Tên</dt><dd>${esc(b.name)}</dd>
      ${b.nameOriginal && b.nameOriginal !== b.name ? `<dt>Tên trong nguồn</dt><dd>${esc(b.nameOriginal)}</dd>` : ''}
      ${b.knownAliases.length ? `<dt>Tên khác</dt><dd>${esc(b.knownAliases.join(' · '))}</dd>` : ''}
      ${b.identitySourceDomains.length ? `<dt>Nguồn đối chiếu</dt><dd>${esc(b.identitySourceDomains.join(' · '))}</dd>` : ''}
    </dl>
    ${links.length ? `<div class="pf__cta">${links.map((url, index) => `<a class="btn btn--outline" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Nguồn ${index + 1} ${icon('external', { size: 12 })}</a>`).join('')}</div>` : ''}
    <p class="pf__note">Cập nhật dữ liệu: ${esc(dateTime(data.generatedAt))}.</p>
  </section>`;
}

function duration(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return '—';
  const minutes = Math.round(Number(seconds) / 60);
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `${hours} giờ ${remain} phút` : `${hours} giờ`;
}
