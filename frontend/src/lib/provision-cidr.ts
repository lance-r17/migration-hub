import type { ProvisionCidrParents } from '@/types/settings'

/**
 * CIDR helpers for environment provisioning.
 *
 * Project-level zone CIDRs must be network-aligned blocks carved from the configured
 * parent blocks (see DEFAULT_PROVISION_CIDR_PARENTS) with an allowed prefix length
 * (DEFAULT_PROVISION_ALLOWED_PREFIXES). Both are admin-overridable via
 * /admin/provision-cidrs, stored in migration settings (`provision_cidr_parents`,
 * `provision_allowed_prefixes`).
 */

export const DEFAULT_PROVISION_ALLOWED_PREFIXES: number[] = [25, 26, 27]

export const DEFAULT_PROVISION_CIDR_PARENTS: ProvisionCidrParents = {
  dev: {
    zoneA: ['10.248.32.0/20', '10.248.48.0/20', '10.248.64.0/20'],
    zoneB: ['10.248.160.0/20', '10.248.176.0/20', '10.248.192.0/20'],
    zoneC: ['10.249.32.0/20', '10.249.48.0/20', '10.249.64.0/20'],
  },
  prod: {
    zoneA: ['10.248.80.0/20', '10.248.96.0/20', '10.248.112.0/20'],
    zoneB: ['10.248.208.0/20', '10.248.224.0/20', '10.248.240.0/20'],
    zoneC: ['10.249.80.0/20', '10.249.96.0/20', '10.249.112.0/20'],
  },
}

export interface ParsedCidr {
  base: number    // network address as uint32
  prefix: number
}

function prefixMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

/** Parses 'a.b.c.d/prefix' into uint32 base + prefix; null when malformed. */
export function parseCidr(cidr: string): ParsedCidr | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr.trim())
  if (!m) return null
  const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (octets.some(o => o > 255)) return null
  const prefix = Number(m[5])
  if (prefix > 32) return null
  const base = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0)
  return { base, prefix }
}

/** True when the address is the network base of its own block (e.g. 10.248.32.0/26, not 10.248.32.4/26). */
export function isNetworkAligned(parsed: ParsedCidr): boolean {
  return (parsed.base & prefixMask(parsed.prefix)) >>> 0 === parsed.base
}

/**
 * Validates a project zone CIDR: allowed prefix length, network-aligned, and fully
 * contained in at least one of the given parent blocks.
 */
export function isValidProvisionCidr(cidr: string, parents: string[], allowedPrefixes: number[] = DEFAULT_PROVISION_ALLOWED_PREFIXES): boolean {
  const parsed = parseCidr(cidr)
  if (!parsed) return false
  if (!allowedPrefixes.includes(parsed.prefix)) return false
  if (!isNetworkAligned(parsed)) return false
  for (const parent of parents) {
    const p = parseCidr(parent)
    if (!p) continue
    if (parsed.prefix >= p.prefix && ((parsed.base & prefixMask(p.prefix)) >>> 0) === p.base) return true
  }
  return false
}

/** True when two CIDR blocks overlap (either contains the other's network base). */
export function cidrRangesOverlap(a: string, b: string): boolean {
  const pa = parseCidr(a)
  const pb = parseCidr(b)
  if (!pa || !pb) return false
  const [smaller, larger] = pa.prefix <= pb.prefix ? [pa, pb] : [pb, pa]
  return ((larger.base & prefixMask(smaller.prefix)) >>> 0) === smaller.base
}

/** Formats allowed prefixes for UI copy, e.g. '/25, /26 or /27'. */
export function formatAllowedPrefixes(prefixes: number[]): string {
  const list = [...prefixes].sort((a, b) => a - b).map(p => `/${p}`)
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}`
}

/** Validates a parent CIDR block (admin page): well-formed and network-aligned, any prefix. */
export function isValidParentCidr(cidr: string): boolean {
  const parsed = parseCidr(cidr)
  return parsed !== null && isNetworkAligned(parsed)
}
