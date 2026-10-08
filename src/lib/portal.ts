import { store, type Row } from "./store";
import { createBooking } from "./actions";
import { linkCustomers } from "./relations";
import { dateKey } from "./format";
import type { BookingRequest, Customer, Gender, PortalAccount, PortalPerson, Service, Staff } from "./types";

export const digits = (phone?: string) => {
  let d = (phone ?? "").replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  return d;
};

export async function savePersons(email: string, account: PortalAccount | null, persons: PortalPerson[], name: string) {
  if (account) await store.update("accounts", email, { persons });
  else await store.set("accounts", email, { name, persons, createdAt: Date.now() } satisfies PortalAccount);
}

export interface RequestPerson {
  person: PortalPerson;
  complaint: string;
  staff: Row<Staff> | null;
}

/** One request per person; the family shares a batch so the desk sees them together. */
export async function submitRequests(
  account: { email: string; name: string; holderPhone?: string },
  service: Row<Service>,
  startAt: number,
  people: RequestPerson[],
) {
  const batchId = store.newId("requests");
  for (const p of people) {
    const r: BookingRequest = {
      accountEmail: account.email,
      accountName: account.name,
      batchId,
      personId: p.person.id,
      personName: p.person.name.trim(),
      phone: p.person.phone.trim(),
      gender: p.person.gender,
      relation: p.person.relation ?? null,
      holderPhone: account.holderPhone ?? null,
      complaint: p.complaint.trim(),
      serviceId: service.id,
      serviceName: service.name,
      durationMin: service.durationMin,
      staffId: p.staff?.id ?? null,
      staffName: p.staff?.name ?? null,
      startAt,
      dateKey: dateKey(startAt),
      status: "pending",
      createdAt: Date.now(),
    };
    await store.add("requests", r);
  }
  return batchId;
}

export const cancelRequest = (id: string) => store.update("requests", id, { status: "cancelled" });

/** Same person if the phone matches, else (no phone) the same name. */
export function matchCustomer(customers: Row<Customer>[], r: Pick<BookingRequest, "phone" | "personName">) {
  const d = digits(r.phone);
  if (d.length >= 8) return customers.find((c) => digits(c.phone) === d) ?? null;
  return customers.find((c) => c.nameLower === r.personName.trim().toLowerCase()) ?? null;
}

/** Front desk accepts: find or create the patient, make the booking, link family on the same account. */
export async function confirmRequest(
  r: Row<BookingRequest>,
  input: { staff: Row<Staff>; service: Row<Service>; startAt: number; customers: Row<Customer>[]; by: string },
) {
  let customer = matchCustomer(input.customers, r);
  if (!customer) {
    const data: Customer = {
      name: r.personName,
      nameLower: r.personName.toLowerCase(),
      phone: r.phone,
      gender: r.gender as Gender | undefined,
      notes: r.complaint || undefined,
      createdAt: Date.now(),
      // Signed up on the website, not registered at the desk.
      source: "online",
      accountEmail: r.accountEmail,
    };
    const id = await store.add("customers", data);
    customer = { id, ...data };
  } else if (!customer.accountEmail) {
    // A patient the desk already knew now books online too: remember which account.
    await store.update("customers", customer.id, { accountEmail: r.accountEmail });
  }
  const bookingId = await createBooking({
    customer,
    staff: input.staff,
    service: input.service,
    startAt: input.startAt,
    durationMin: input.service.durationMin,
    notes: r.complaint ? `${r.complaint} (booking online)` : "Booking online",
  });
  await store.update("requests", r.id, {
    status: "confirmed",
    bookingId,
    customerId: customer.id,
    confirmedStaffName: input.staff.name,
    confirmedStartAt: input.startAt,
    handledBy: input.by,
    handledAt: Date.now(),
  });
  // A child or parent booked from the holder's account: connect them in the family graph.
  if (r.relation && r.relation !== "self" && r.holderPhone) {
    const holder = input.customers.find((c) => digits(c.phone) === digits(r.holderPhone!));
    if (holder && holder.id !== customer.id && !(holder.links ?? []).some((l) => l.id === customer!.id))
      await linkCustomers(holder, customer, r.relation).catch(() => {});
  }
  return bookingId;
}

export const rejectRequest = (id: string, reason: string, by: string) =>
  store.update("requests", id, { status: "rejected", reason: reason.trim(), handledBy: by, handledAt: Date.now() });

export const REQUEST_LABEL: Record<BookingRequest["status"], string> = {
  pending: "Menunggu konfirmasi",
  confirmed: "Dikonfirmasi",
  rejected: "Tidak bisa",
  cancelled: "Dibatalkan",
};
