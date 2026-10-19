#!/usr/bin/env python3
import concurrent.futures
from datetime import datetime, timezone
import json
from pathlib import Path
from lab_aws import call, verify

checks = [
 ('cloudformation','describe-stacks'), ('ec2','describe-instances'),
 ('ec2','describe-volumes'), ('ec2','describe-addresses'), ('ec2','describe-nat-gateways'),
 ('autoscaling','describe-auto-scaling-groups'), ('elbv2','describe-load-balancers'),
 ('elb','describe-load-balancers'), ('rds','describe-db-instances'),
 ('rds','describe-db-clusters'), ('ecs','list-clusters'), ('eks','list-clusters'),
 ('lambda','list-functions'), ('sagemaker','list-endpoints'),
 ('sagemaker','list-notebook-instances'), ('sagemaker','list-apps'),
 ('elasticache','describe-cache-clusters'), ('redshift','describe-clusters'),
 ('cloudformation','list-stack-resources'),
]
checks = checks[:-1]
result={'capturedAt':datetime.now(timezone.utc).isoformat(),'identity':verify(),'regions':{}}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
 futures={pool.submit(call,s,o,region=r,check=False):(r,s,o) for r in ['us-east-1','us-west-2'] for s,o in checks}
 for f in concurrent.futures.as_completed(futures):
  r,s,o=futures[f];result['regions'].setdefault(r,{})[s+':'+o]=f.result()
result['s3']=call('s3api','list-buckets',check=False)
result['cloudfront']=call('cloudfront','list-distributions',check=False)
p=Path(__file__).resolve().parents[3]/'project-implementation/evidence/aws'
p.mkdir(parents=True,exist_ok=True)
out=p/('inventory-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json')
out.write_text(json.dumps(result,indent=2))
print(out)
for r, data in result['regions'].items():
 for check, value in data.items():
  if 'error' in value:print(r,check,value['error'][:180]);continue
  for k,v in value.items():
   if isinstance(v,list) and v:print(r,check,k,len(v))
