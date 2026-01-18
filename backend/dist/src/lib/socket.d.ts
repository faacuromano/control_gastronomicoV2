import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
export declare const initSocket: (httpServer: HttpServer) => Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
export declare const getIO: () => Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>;
//# sourceMappingURL=socket.d.ts.map