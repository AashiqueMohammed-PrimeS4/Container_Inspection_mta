## Application Details
|               |
| ------------- |
|**App Generator**<br>SAP Fiori Application Generator|
|**App Generator Version**<br>1.33.0|
|**Generation Platform**<br>CLI|
|**Template Used**<br>Basic V4|
|**Service Type**<br>OData URL|
|**Service URL**<br>http://localhost:4010/claims/|
|**Module Name**<br>claims|
|**Application Title**<br>Claims|
|**Namespace**<br>|
|**UI5 Theme**<br>sap_horizon|
|**UI5 Version**<br>1.136.0|
|**Enable TypeScript**<br>False|
|**Add Eslint configuration**<br>True, see https://www.npmjs.com/package/@sap-ux/eslint-plugin-fiori-tools#rules for the eslint rules.|

## claims

Carrier claims ticket log

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  To launch the generated application, run the following from the generated application root folder:

```
    npm start
```

- It is also possible to run the application using mock data that reflects the OData Service URL supplied during application generation.  In order to run the application with Mock Data, run the following from the generated app root folder:

```
    npm run start-mock
```

#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)



#### Local backend

The ticket log reads the claims service in `srv/claims`. Start it on port 4010, then start the app with the mocked user so the proxy sends basic auth:

```
    cd ../../srv/claims && npm ci && PORT=4010 node_modules/.bin/cds watch
    cd ../../app/claims && FIORI_TOOLS_USER=alice FIORI_TOOLS_PASSWORD=x npm start
```
