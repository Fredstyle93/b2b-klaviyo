import { AbstractEventProcessor } from '../abstractEventProcessor';
import logger from '../../../../utils/log';
import { Customer, CustomerCreatedMessage } from '@commercetools/platform-sdk';
import config from "config";
export class CustomerCreatedEventProcessor extends AbstractEventProcessor {
    private readonly PROCESSOR_NAME = 'CustomerCreated';
    isEventValid(): boolean {
        const customerCreatedMessage = this.ctMessage as unknown as CustomerCreatedMessage;
        return (
            customerCreatedMessage.resource.typeId === 'customer' &&
            customerCreatedMessage.type === 'CustomerCreated' &&
            !!customerCreatedMessage.customer &&
            !!customerCreatedMessage.customer.email &&
            !this.isEventDisabled(this.PROCESSOR_NAME)
        );
    }
    async generateKlaviyoEvents(): Promise<KlaviyoEvent[]> {
        const message = this.ctMessage as unknown as CustomerCreatedMessage;
        logger.info(`processing CT ${message.resource.typeId}${message.type} message`);
        let customer: Customer;
        if ('customer' in message) {
            customer = message.customer;
        } else {
            customer = (await this.context.ctCustomerService.getCustomerProfile(
                (message as CustomerCreatedMessage).resource.id,
            )) as Customer;
        }
        const klaviyoEvents: KlaviyoEvent[] = [];
        const klaviyoEvent: KlaviyoEvent = {
            body: this.context.customerMapper.mapCtCustomerToKlaviyoProfile(customer),
            type: 'profileCreated',
        };
        klaviyoEvents.push(klaviyoEvent);
        logger.info(`Adding klaviyo events for signing up`);
        // todo: very bad way to fetch customer metrics, I need to find a more robust way.
        const body: EventRequest = this.context.customerMapper.mapCtCustomerToKlaviyoEvent(customer, config.get('customer.metrics.customerCreated'));
        const klaviyoCustomerCreatedMetricEvent: KlaviyoEvent = {
            body: body,
            type: 'event'
        }
        klaviyoEvents.push(klaviyoCustomerCreatedMetricEvent);
        return klaviyoEvents;
    }
}
