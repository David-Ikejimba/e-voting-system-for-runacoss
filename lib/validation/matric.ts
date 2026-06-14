/**
 * Matric number + email validation for RUN students.
 *
 * Matric format: RUN/CMP/XX/XXXXX  (e.g. RUN/CMP/22/00123)
 * Email format:  something@run.edu.ng
 *
 * This is a pure function with zero external dependencies — easy to unit-test.
 */

export type Department = 'CMP' | 'CYB' | 'IFT'

export type ValidResult = {
  valid: true
  department: Department
  matricNo: string // normalized uppercase
}

export type InvalidResult = {
  valid: false
  error:
    | 'DOMAIN_MISMATCH'        // email is not @run.edu.ng
    | 'FORMAT_MISMATCH'        // matric doesn't match RUN/XXX/XX/XXXXX
    | 'UNSUPPORTED_DEPARTMENT' // department code not in [CMP, CYB, IFT]
    | 'DIGIT_MISMATCH'         // numeric parts don't match email prefix
}

const MATRIC_REGEX = /^RUN\/(CMP|CYB|IFT)\/(\d{2})\/(\d{5})$/
const SUPPORTED_DEPARTMENTS: Department[] = ['CMP', 'CYB', 'IFT']
const EMAIL_DOMAIN = 'run.edu.ng'

export function validateMatricAndEmail(
  email: string,
  matricNo: string
): ValidResult | InvalidResult {
  // Normalize inputs
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedMatric = matricNo.trim().toUpperCase()

  // 1. Check email domain
  const emailParts = normalizedEmail.split('@')
  if (emailParts.length !== 2 || emailParts[1] !== EMAIL_DOMAIN) {
    return { valid: false, error: 'DOMAIN_MISMATCH' }
  }

  // 2. Parse matric number format
  const match = normalizedMatric.match(MATRIC_REGEX)
  if (!match) {
    return { valid: false, error: 'FORMAT_MISMATCH' }
  }

  const [, deptCode, yearDigits, serialDigits] = match

  // 3. Validate department
  if (!SUPPORTED_DEPARTMENTS.includes(deptCode as Department)) {
    return { valid: false, error: 'UNSUPPORTED_DEPARTMENT' }
  }

  // 4. Check that the numeric serial in the matric appears in the email prefix
  const emailPrefix = emailParts[0]
  const emailDigits = emailPrefix.replace(/\D/g, '') // strip non-digits from prefix

  if (!emailDigits.includes(serialDigits)) {
    return { valid: false, error: 'DIGIT_MISMATCH' }
  }

  return {
    valid: true,
    department: deptCode as Department,
    matricNo: normalizedMatric,
  }
}
