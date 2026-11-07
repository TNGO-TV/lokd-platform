import { scheduleLabel } from './booking-schedule';
export const zoneServices = [
  { code: 'standard_unarmed', label: 'Unarmed guarding', serviceType: 'Unarmed', icon: 'shield' },
  { code: 'armed_static', label: 'Armed site security', serviceType: 'Armed', icon: 'shield' },
  { code: 'armed_movement', label: 'Armed movement', serviceType: 'Armed', icon: 'route' },
  { code: 'vip_unarmed', label: 'VIP protection', serviceType: 'VIP', icon: 'user' },
  { code: 'vip_protective_driver', label: 'Protective driver', serviceType: 'VIP', icon: 'car' },
  { code: 'event_cover', label: 'Event cover', serviceType: 'Unarmed', icon: 'people' },
] as const;
export type ZoneServiceCode = typeof zoneServices[number]['code'];
export type ZoneCoverType = 'bolt' | 'flex' | 'fixed';
export const zoneCoverOptions = [
  { value: 'bolt', label: 'Immediate / Emergency Service', model: 'LOKD Bolt', detail: 'Less than 72 Hours Notice', icon: 'clock' },
  { value: 'flex', label: 'Temporary / Flexible Service', model: 'LOKD Flex', detail: '7+ Days in a calendar month', icon: 'calendar' },
  { value: 'fixed', label: 'Full time deployment', model: 'LOKD Fixed', detail: '3 Months +', icon: 'people' },
] as const;
export function sastDate(now = new Date()) { return new Date(now.getTime() + 7_200_000).toISOString().slice(0, 10); }
export function zoneService(code: unknown) { return zoneServices.find(item => item.code === code); }
export const rosterLabel = scheduleLabel;
export function bookingStage(status: string) {
  if (status === 'in_progress') return 'On site';
  if (status === 'confirmed') return 'Officers confirmed';
  if (['awaiting_assignment', 'partially_staffed', 'active'].includes(status)) return 'Finding your officers';
  if (status === 'completed') return 'Shift complete';
  if (status === 'cancelled') return 'Booking cancelled';
  return 'Booking under review';
}
