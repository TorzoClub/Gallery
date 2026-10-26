import pkg from '../../package.json'

export default function BehindApp() {
  return (
    <div>
      Behind test
      <h1>About</h1>
      <p>同装相册v{pkg.version}</p>
    </div>
  )
}
