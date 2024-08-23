import * as gcp from '@pulumi/gcp';

export interface HasPathRules {
  pathRules: () => gcp.types.input.compute.URLMapPathMatcherPathRule[];
}
