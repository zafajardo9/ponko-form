import { paymentRegistry } from './registry'
import { PayPalGateway } from './paypal/gateway'
import { XenditGateway } from './xendit/gateway'
import { MayaGateway } from './maya/gateway'

paymentRegistry.register(new PayPalGateway())
paymentRegistry.register(new XenditGateway())
paymentRegistry.register(new MayaGateway())

export { paymentRegistry }
