function API(host, apiToken) {
  this.host = host;
  this.apiTokenEncoded = new Buffer(apiToken+':x-auth-token').toString('base64');
}

API.prototype.buildRequestUrl = function(path) {
  return this.host + '/api/v1' + path;
}

API.prototype.request = function(requester, path, method, body) {
  var headers = {
    "Authorization": 'Basic ' + this.apiTokenEncoded
  };

  if(body) {
    headers["Content-Type"] = "application/json";
  }

  return requester(
    this.buildRequestUrl(path), 
    method || "GET",
    headers,
    body
  );
}

API.prototype.getDocumentIds = function(requester, docSetId) {
  return this.request(
    requester,
    "/document-sets/" + docSetId + "/documents?fields=id"
  );
};

API.prototype.getDocument = function(requester, docId, docSetId) {
  return this.request(
    requester,
    "/document-sets/" + docSetId + "/documents/" + docId
  );
};

API.prototype.getAllDocuments = function(requester, docSetId, sort) {
  return this.request(
    requester, 
    "/document-sets/" + docSetId + "/documents?stream=true&fields=id,text&sort=" + sort
  );
}

API.prototype.getStoreState = function(requester) {
  return this.request(requester, '/store/state');
}

API.prototype.setStoreState = function(requester, state) {
  return this.request(requester, '/store/state', 'PUT', state);
}

API.prototype.getStoreObjects = function(requester) {
  return this.request(requester, '/store/objects');
}

API.prototype.createStoreObject = function(requester, state) {
  return this.request(requester, '/store/objects', 'POST', state);
}

API.prototype.updateStoreObject = function(requester, StoreObjectId, state) {
  return this.request(requester, '/store/objects/' + StoreObjectId, 'PUT', state);
}

module.exports = API;
