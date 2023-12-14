// import Cookies from 'js-cookie'

const TokenKey = 'TORZO_GALLERY_DASHBOARD_TOKEN'

export function getToken() {
  return localStorage[TokenKey]
}

export function setToken(token) {
  localStorage[TokenKey] = token
  return token
}

export function removeToken() {
  delete localStorage[TokenKey]
}
