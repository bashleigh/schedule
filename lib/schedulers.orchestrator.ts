import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { CronCommand, CronJob } from 'cron';
import uuid from 'uuid/v4';
import { CronOptions } from './decorators/cron.decorator';
import { SchedulersRegistry } from './schedulers.registry';

type TargetHost = { target: Function };
type TimeoutHost = { timeout: number };
type RefHost<T> = { ref?: T };

type CronOptionsHost = {
  options: CronOptions & Record<'cronTime', string | Date | any>;
};

type IntervalOptions = TargetHost & TimeoutHost & RefHost<number>;
type TimeoutOptions = TargetHost & TimeoutHost & RefHost<number>;
type CronJobOptions = TargetHost & CronOptionsHost & RefHost<CronJob>;

@Injectable()
export class SchedulersOrchestrator
  implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly cronJobs: Record<string, CronJobOptions> = {};
  private readonly timeouts: Record<string, TimeoutOptions> = {};
  private readonly intervals: Record<string, IntervalOptions> = {};

  constructor(private readonly schedulersRegistry: SchedulersRegistry) {}

  onApplicationBootstrap() {
    this.mountTimeouts();
    this.mountIntervals();
    this.mountCron();
  }

  onApplicationShutdown(signal?: string | undefined) {
    this.clearTimeouts();
    this.clearIntervals();
    this.closeCronJobs();
  }

  mountIntervals() {
    const intervalKeys = Object.keys(this.intervals);
    intervalKeys.forEach(key => {
      const options = this.intervals[key];
      const intervalRef = setInterval(options.target, options.timeout);

      options.ref = intervalRef;
      this.schedulersRegistry.addInterval(key, intervalRef);
    });
  }

  mountTimeouts() {
    const timeoutKeys = Object.keys(this.timeouts);
    timeoutKeys.forEach(key => {
      const options = this.timeouts[key];
      const timeoutRef = setTimeout(options.target, options.timeout);

      options.ref = timeoutRef;
      this.schedulersRegistry.addTimeout(key, timeoutRef);
    });
  }

  mountCron() {
    const cronKeys = Object.keys(this.cronJobs);
    cronKeys.forEach(key => {
      const { options, target } = this.cronJobs[key];
      const cronJob = new CronJob(
        options.cronTime,
        target as CronCommand,
        undefined,
        false,
        options.timeZone,
        undefined,
        false,
        options.utcOffset,
        options.unrefTimeout,
      );
      cronJob.start();

      this.cronJobs[key].ref = cronJob;
      this.schedulersRegistry.addCron(key, cronJob);
    });
  }

  clearTimeouts() {
    const keys = Object.keys(this.timeouts);
    keys.forEach(key => clearTimeout(this.timeouts[key].ref));
  }

  clearIntervals() {
    const keys = Object.keys(this.intervals);
    keys.forEach(key => clearInterval(this.intervals[key].ref));
  }

  closeCronJobs() {
    const keys = Object.keys(this.cronJobs);
    keys.forEach(key => this.cronJobs[key].ref!.stop());
  }

  addTimeout(methodRef: Function, timeout: number, name: string = uuid()) {
    this.timeouts[name] = {
      target: methodRef,
      timeout,
    };
  }

  addInterval(methodRef: Function, timeout: number, name: string = uuid()) {
    this.intervals[name] = {
      target: methodRef,
      timeout,
    };
  }

  addCron(
    methodRef: Function,
    options: CronOptions & Record<'cronTime', string | Date | any>,
  ) {
    const name = options.name || uuid();
    this.cronJobs[name] = {
      target: methodRef,
      options,
    };
  }
}
