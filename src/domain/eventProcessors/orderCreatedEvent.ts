import { AbstractEvent } from './abstractEvent';
import logger from '../../utils/log';
import { OrderCreatedMessage } from '@commercetools/platform-sdk/dist/declarations/src/generated/models/message';
import { Order, OrderState } from '@commercetools/platform-sdk';
import { getTypedMoneyAsNumber } from '../../utils/get-typed-money-as-number';

export class OrderCreatedEvent extends AbstractEvent {
    isEventValid(): boolean {
        const orderCreatedMessage = this.ctMessage as unknown as OrderCreatedMessage;
        return (
            orderCreatedMessage.resource.typeId === 'order' &&
            orderCreatedMessage.type === 'OrderCreated' &&
            !!orderCreatedMessage.order &&
            (!!orderCreatedMessage.order.customerEmail || !!orderCreatedMessage.order.customerId) &&
            this.isValidState(orderCreatedMessage.order?.orderState)
        );
    }

    generateKlaviyoEvents(): KlaviyoEvent[] {
        const orderCreatedMessage = this.ctMessage as unknown as OrderCreatedMessage;
        logger.info('Processing order created event');

        const body = {
            data: {
                type: 'event',
                attributes: {
                    profile: this.getCustomerProfile(orderCreatedMessage.order),
                    metric: {
                        name: 'Order created',
                    },
                    value: getTypedMoneyAsNumber(orderCreatedMessage.order?.totalPrice),
                    properties: { ...orderCreatedMessage.order } as any,
                    unique_id: orderCreatedMessage.order.id,
                    time: orderCreatedMessage.order.createdAt,
                },
            },
        };

        const events: KlaviyoEvent[] = [{ body, type: 'event' }];

        this.getProductOrderedEventsFromOrder(events, orderCreatedMessage.order);

        return events;
    }

    private getCustomerProfile(order: Order): KlaviyoEventProfile {
        const profile: KlaviyoEventProfile = {};
        if (order.customerEmail) {
            profile.$email = order.customerEmail;
        }
        if (order.customerId) {
            profile.$id = order.customerId;
        }
        return profile;
    }

    private isValidState(orderState: OrderState): boolean {
        return (process.env.ORDER_CREATED_STATES || 'Open').split(/[, ]+/g).includes(orderState);
    }

    private getProductOrderedEventsFromOrder(events: KlaviyoEvent[], order: Order) {
        order?.lineItems?.forEach((lineItem) => {
            events.push({
                body: {
                    data: {
                        type: 'event',
                        attributes: {
                            profile: this.getCustomerProfile(order),
                            metric: {
                                name: 'Ordered Product',
                            },
                            value: getTypedMoneyAsNumber(lineItem.totalPrice),
                            properties: { ...lineItem },
                            unique_id: lineItem.id,
                            time: order.createdAt,
                        },
                    },
                },
                type: 'event',
            });
        });
    }
}
