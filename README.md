```Ts
import { AnterAja } from "@kengx/anteraja"

const anterAja = new AnterAja({
        auth: {
          "access-key-id": "your-access-key-id",
          "secret-access-key": "your-secret-access-key",
        },
        baseUrl: "your-base-url",
      })

  const servicesRoutes = await anterAja.request({
        path: "/serviceRates",
        method: "post",
        body: {
          origin: "31.73.06",
          destination: "31.73.06",
          weight: 2000,
        },
      })

console.log('response:', servicesRoutes)
```
