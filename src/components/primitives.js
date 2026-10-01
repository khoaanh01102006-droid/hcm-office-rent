/* Thành phần dùng chung. Mỗi thứ ở đây giữ đúng một lời hứa về tính trung
   thực của dữ liệu, không chỉ về hình thức.
   Ngôn ngữ hình ảnh theo shadcn/ui: badge viền mảnh, chữ nhỏ, icon 13–14px. */

import { NHAN } from '../che_do.js';
import { icon } from '../icons.js';
import { FieldState, isPresent } from '../data.js';
import { money, distance, dateShort, ageInDays, percent } from '../format.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------------------------------------------------------------------
   1. Vắng mặt có BA trạng thái khác nhau, ba cách hiển thị khác nhau.
   Không trạng thái nào được hiển thị bằng số 0.
   ------------------------------------------------------------------------ */
export function missingChip(state = FieldState.NOT_COLLECTED, detail = null, label = null) {
  const map = {
    [FieldState.NOT_COLLECTED]: { text: 'Chưa thu thập', title: 'Chưa có dữ liệu cho mục này.' },
    [FieldState.ZERO_OBSERVED]: { text: 'Không có kết quả', title: 'Không tìm thấy địa điểm nào trong phạm vi tìm.' },
    [FieldState.NOT_PUBLISHED]: { text: 'Nguồn không công bố', title: 'Nguồn không công bố số này.' },
  };
  const m = map[state] || map[FieldState.NOT_COLLECTED];
  return `<span class="badge badge--missing" data-state="${state}" title="${esc(detail || m.title)}">
    ${icon('dashCircle', { size: 12 })}${esc(label || m.text)}</span>`;
}

export function fieldValue(f, { format = (v) => v, suffix = '' } = {}) {
  if (!isPresent(f)) return missingChip(f?.state);
  return `<span class="val">${esc(format(f.value))}${suffix ? `<span class="val__unit">${esc(suffix)}</span>` : ''}</span>`;
}

/* ---------------------------------------------------------------------------
   2. Thanh cấu thành giá — đơn sắc ba mức, đọc được cả khi in đen trắng.
   ------------------------------------------------------------------------ */
export function rentBar(b, { scaleMax, compact = false, showVat = true } = {}) {
  const base = isPresent(b.baseRent) ? b.baseRent.value : null;
  const svc = isPresent(b.serviceCharge) ? b.serviceCharge.value : null;
  const vatAmt = isPresent(b.grossIncVat) && isPresent(b.grossExVat) ? b.grossIncVat.value - b.grossExVat.value : null;
  if (base == null) return missingChip();

  const max = scaleMax || (base + (svc || 0) + (vatAmt || 0));
  const parts = [
    { v: base, cls: 'base', label: 'Rent 03/2026' },
    { v: svc, cls: 'service', label: 'Phí dịch vụ' },
  ];
  if (showVat) parts.push({ v: vatAmt, cls: 'vat', label: 'VAT' });

  const segs = parts.filter((p) => p.v != null).map((p) =>
    `<span class="rentbar__seg rentbar__seg--${p.cls}" style="width:${((p.v / max) * 100).toFixed(2)}%"
      title="${esc(p.label)}: ${esc(money(p.v))} ${esc(b.baseRent.unit || 'đơn vị nguồn')}"></span>`).join('');

  const legend = compact ? '' : `<div class="rentbar__legend">
      <span class="rentbar__key"><i class="sw sw--base"></i>Rent 03/2026 ${esc(money(base))}</span>
      <span class="rentbar__key"><i class="sw sw--service"></i>Phí DV ${svc == null ? '—' : esc(money(svc))}</span>
      ${showVat ? `<span class="rentbar__key"><i class="sw sw--vat"></i>VAT ${vatAmt == null ? '—' : esc(money(vatAmt))}</span>` : ''}
    </div>`;

  return `<div class="rentbar">
    <div class="rentbar__track" role="img"
      aria-label="Rent tháng 03 năm 2026: ${esc(money(base))} ${esc(b.baseRent.unit || 'đơn vị nguồn')}; phí dịch vụ ${svc == null ? 'chưa có dữ liệu' : esc(money(svc))}${showVat && vatAmt != null ? `, VAT ${esc(money(vatAmt))}` : ''}.">
      ${segs}
    </div>${legend}
  </div>`;
}

/* ---------------------------------------------------------------------------
   3. Dải hai nguồn giá — chỉ hiện khi thật sự có hai nguồn có thể so sánh.
   ------------------------------------------------------------------------ */
export function sourceBandBlock(b, { compact = false } = {}) {
  if (!b.sourceBand) {
    const missing = b.sources.find((s) => !s.publishesPrice);
    return `<div class="band band--single">
      ${icon('info', { size: 13 })} Chỉ một nguồn công bố giá.${missing
        ? ` ${esc(missing.label)}: ${esc(missing.statusLabel).toLowerCase()}${missing.rentRaw ? ` (“${esc(missing.rentRaw)}”)` : ''}.` : ''}
    </div>`;
  }
  const { low, high, spreadPct, entries } = b.sourceBand;
  const span = high - low || 1;
  const tone = spreadPct >= 15 ? 'warn' : spreadPct >= 8 ? 'mid' : 'ok';

  const dots = entries.map((e) => {
    const x = ((e.grossExVat - low) / span) * 100;
    return `<span class="band__dot ${e.selected ? 'is-selected' : ''}" style="left:${x.toFixed(1)}%"
      title="${esc(e.label)}: ${esc(money(e.grossExVat))} USD/m²/tháng · truy xuất ${esc(dateShort(e.retrievedAt))}"></span>`;
  }).join('');

  const rows = compact ? '' : `<ul class="band__rows">${entries.map((e) => `<li>
      <span class="band__src">${esc(e.label)}${e.selected ? '<em class="band__pick">nguồn đang chọn</em>' : ''}</span>
      <span class="band__num">${esc(money(e.grossExVat))}</span>
      <span class="band__date">${esc(dateShort(e.retrievedAt))}</span>
      <a class="band__link" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">
        Mở nguồn ${icon('external', { size: 11 })}<span class="sr-only"> — ${esc(e.label)}, mở tab mới</span></a>
    </li>`).join('')}</ul>`;

  return `<div class="band band--${tone}">
    <div class="band__head">
      <span class="band__title">Hai nguồn niêm yết · tổng trước VAT</span>
      <span class="band__spread">${esc(money(low))} – ${esc(money(high))}
        <span class="band__unit">USD/m²/tháng</span><em>lệch ${esc(percent(spreadPct, 1))}</em></span>
    </div>
    <div class="band__track" role="img"
      aria-label="Hai nguồn niêm yết tổng trước VAT: ${entries.map((e) => `${e.label} ${money(e.grossExVat)}`).join(', ')} USD trên mét vuông mỗi tháng, chênh lệch ${percent(spreadPct, 1)}.">
      <span class="band__span" style="left:0;right:0"></span>${dots}
    </div>
    ${rows}
  </div>`;
}

/* ---- 4. Hạng: chữ cái là kênh chính, luôn kèm "theo nguồn" -------------- */
export function gradeBadge(b, { withNote = true } = {}) {
  return `<span class="badge grade" title="${esc(b.gradeField.definition)}">
    ${esc(b.gradeLabel)}</span>`;
}

/* ---- 5. Đối chiếu giá: icon + chữ, không chỉ màu ------------------------ */
export function crosscheckChip(b) {
  // Cả 407 tòa của bộ giá giao dịch chỉ có một nguồn, nên không có gì để đối chiếu: không hiện gì.
  if (b.crosscheckRaw === 'UNRESOLVED_COMPONENTS') return '';
  const tone = { ok: 'ok', warn: 'warn', missing: 'missing' }[b.crosscheck.tone] || 'muted';
  const ic = { ok: 'checkCircle', warn: 'alert', missing: 'dashCircle' }[b.crosscheck.tone] || 'info';
  return `<span class="badge badge--${tone}" title="Mức chênh giá giữa hai nguồn">
    ${icon(ic, { size: 12 })}${esc(b.crosscheck.text)}</span>`;
}

/* ---- 6. Thời điểm, kèm "cách đây N ngày" ------------------------------- */
export function freshness(ts, { label = 'Cập nhật' } = {}) {
  const d = dateShort(ts);
  if (!d) return missingChip();
  const age = ageInDays(ts);
  return `<span class="fresh badge badge--muted" title="${esc(label)} ${esc(d)}">
    ${icon('clock', { size: 12 })}${esc(label)} ${esc(d)}${age != null ? ` · ${age} ngày trước` : ''}</span>`;
}

/* ---- 7. Khoảng cách metro — định nghĩa đi liền con số ------------------- */
export function metroLine(b) {
  if (!isPresent(b.distanceMetro)) return missingChip(b.distanceMetro.state);
  return `<span class="metro" title="${esc(b.distanceMetro.definition)}">
    ${icon('train', { size: 13 })}Ga ${esc(b.nearestMetro)} · <b>${esc(distance(b.distanceMetro.value))}</b></span>`;
}

export const sampleNote = (n = 407) =>
  `<span class="samplenote" title="${n} tòa nhà văn phòng · ${NHAN.giaDai}">${n} tòa nhà · ${NHAN.giaNgan}</span>`;
