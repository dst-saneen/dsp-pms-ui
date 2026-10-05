import type { CreateJobOpeningDto } from "./create-job-opening";

export interface UpdateJobOpeningDto extends CreateJobOpeningDto {
  version: number;
}
