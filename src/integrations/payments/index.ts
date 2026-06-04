import { paymentRegistry } from './registry'
import { PayPalGateway } from './paypal/gateway'
import { XenditGateway } from './xendit/gateway'

paymentRegistry.register(new PayPalGateway())
paymentRegistry.register(new XenditGateway())

export { paymentRegistry }
