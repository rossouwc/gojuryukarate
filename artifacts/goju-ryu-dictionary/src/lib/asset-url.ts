export function versionedAssetUrl(
  path: string,
  baseUrl: string,
  versions: Readonly<Record<string, string>>,
): string {
  const cleanPath = path.replace(/^\/+/, '');
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const fragmentAt = cleanPath.indexOf('#');
  const fragment = fragmentAt < 0 ? '' : cleanPath.slice(fragmentAt);
  const resource = fragmentAt < 0 ? cleanPath : cleanPath.slice(0, fragmentAt);
  const queryAt = resource.indexOf('?');
  const pathname = queryAt < 0 ? resource : resource.slice(0, queryAt);
  const version = versions[pathname];
  if (!version) return `${base}${cleanPath}`;

  const query = new URLSearchParams(queryAt < 0 ? '' : resource.slice(queryAt + 1));
  query.set('v', version);
  return `${base}${pathname}?${query.toString()}${fragment}`;
}
