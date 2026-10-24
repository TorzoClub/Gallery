import { serve } from "@hono/node-server"
import { constructApi } from "./api"
import Instance from "./instance"

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

function createServer() {
  const app = constructApi()
  serve({
    fetch: app.fetch,
    port,
  })
  const inst = Instance({
    storage_path: './storage',
    // avatar_thumb_size: 128,
    // image_thumb_size: 256,
  })
}
