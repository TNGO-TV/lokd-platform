// Own disposable fixture resources before setup can fail. Cleanup is idempotent,
// runs in reverse acquisition order and attempts every callback even on failure.
export function fixtureScope(){
 const callbacks=[];let closed=false;
 return {
  after(callback){if(closed)throw Error('Fixture scope is already closed');callbacks.push(callback);},
  close(){if(closed)return;closed=true;const errors=[];for(const callback of callbacks.reverse())try{callback();}catch(error){errors.push(error);}callbacks.length=0;if(errors.length)throw new AggregateError(errors,'Fixture cleanup failed');},
  fail(error){try{this.close();}catch(cleanup){throw new AggregateError([error,cleanup],'Fixture setup and cleanup failed');}throw error;},
 };
}
