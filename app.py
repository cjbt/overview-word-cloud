from flask import Flask, jsonify, request, make_response, render_template
from flask.ext.runner import Runner
from lib.overview import OverviewAPI
from collections import Counter
import requests
import string
import json
import re
import base64

app = Flask(__name__)
runner = Runner(app)

def get_standard_query_params(request):
    params = ['server', 'apiToken', 'documentSetId', 'vizId']
    return {key:request.args.get(key) for key in params}

@app.route("/metadata", methods=['GET'])
def metadata():
    return make_response("", 204, {'Access-Control-Allow-Origin': '*'})

@app.route("/show", methods=['GET'])
def show():
    params = get_standard_query_params(request)
    api_token_encoded = base64.b64encode(params['apiToken'] + ':x-auth-token')
    return render_template('show.html', api_token_encoded=api_token_encoded)

if __name__ == "__main__":
        runner.run()