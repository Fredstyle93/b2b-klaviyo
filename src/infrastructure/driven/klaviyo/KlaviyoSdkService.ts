import { KlaviyoService } from './KlaviyoService';
import logger from '../../../utils/log';
import { Client, ConfigWrapper, Events, Profiles } from "klaviyo-api";
import { StatusError } from "../../../types/errors/StatusError";
import * as dotenv from "dotenv";
dotenv.config();

if(!process.env.KLAVIYO_AUTH_KEY){
    logger.error('The environment variable KLAVIYO_AUTH_KEY is not set. Please set the env variable as described in the plugin installation guide and restart the application')
}

ConfigWrapper(process.env.KLAVIYO_AUTH_KEY);
export class KlaviyoSdkService extends KlaviyoService {
    public async sendEventToKlaviyo(event: KlaviyoEvent): Promise<any> {
        logger.info('Sending event to Klaviyo', { zdata: event.body });
        switch (event.type) {
            case 'event':
                return Events.createEvent(event.body);
            case 'profileCreated':
                return this.createOrUpdateProfile(event.body);
            case 'profileResourceUpdated':
                return Profiles.updateProfile(event.body, event.body.data?.id);
            case 'profileUpdated':
                return Client.createClientProfile(event.body, process.env.KLAVIYO_COMPANY_ID);
            default:
                throw new Error(`Unsupported event type ${event.type}`);
        }
    }

    public async getKlaviyoProfileByExternalId (externalId: string): Promise<ProfileType | undefined> {
        logger.info(`Getting profile in Klaviyo with externalId ${externalId}`);
        try {
            const filter = `equals(external_id,"${externalId}")`;
            const profiles = await Profiles.getProfiles({ filter });
            logger.debug('Profiles response', profiles);
            const profile = profiles?.body.data?.find(
              (profile: ProfileType) => profile.attributes.external_id === externalId,
            );
            logger.debug('Profile', profile);
            return profile;
        } catch (e) {
            logger.error(`Error getting profile in Klaviyo with externalId ${externalId}`);
            throw e;
        }
    }

    private async createOrUpdateProfile (body: KlaviyoRequestType) {
        try {
            return await Profiles.createProfile(body);
        } catch (e: any) {
            if (e.status === 409) {
                let duplicateProfileId;
                try {
                    duplicateProfileId = JSON.parse(e?.response?.error?.text)?.errors[0]?.meta?.duplicate_profile_id;
                } catch (e) {
                    logger.error('Error getting duplicated profile id from error response', e);
                    throw new StatusError(
                      400,
                      `Duplicated profile, error getting duplicated profile id from error response. Request body: ${JSON.stringify(
                        body,
                      )}`,
                    );
                }
                logger.info(`Duplicated profile with id ${duplicateProfileId}. Updating profile...`);
                body.data.id = duplicateProfileId;
                return Profiles.updateProfile(body, duplicateProfileId);
            }
            throw e;
        }
    }
}