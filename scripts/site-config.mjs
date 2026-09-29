// @ts-check
/**
 * Validate the deployment prefix before inserting it into HTML. Only local,
 * slash-delimited path segments are allowed; no origins, HTML, or traversal.
 * @param {string} value
 * @returns {string}
 */
export function validateBasePath(value) {
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*$/.test(value) ||
      value.split('/').some(segment => segment === '.' || segment === '..')) {
    throw new Error('DESKWISE_BASE_PATH must be a local path with leading/trailing slashes, such as /Face-Analyzer/.');
  }
  return value;
}
