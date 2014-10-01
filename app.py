from flask import Flask, jsonify, request, make_response, render_template
from flask.ext.runner import Runner
from lib.overview import OverviewAPI
from collections import Counter
import requests
import string
import json
import re

app = Flask(__name__)
runner = Runner(app)

def get_tokens(text):
    # Lowercase the text. Then, with the regex, normalize all space-like 
    # characters (\n, \t, \r, etc) and multiple consecutive spaces to single 
    # spaces. Then split on those spaces.
    #
    # The regex below also replaces dashes (double hyphens) with spaces. 
    # This is because, while I want to keep intra-word punctuation to produce 
    # friendlier tokens, dashes, when  unspaced, look like intra-word 
    # punctuation but aren't.
    punctuated_tokens = re.sub("(?:--)|\s+", " ", text.lower()).split(' ')

    # Now, we just remove inter-word punctuation.
    tokens = [token.strip(string.punctuation) for token in punctuated_tokens]

    # and filter out blank tokens
    return filter(lambda token: len(token) > 0, tokens)

def get_top_terms(dataDict, num_terms = 200):
    term_frequency_tuples = dataDict.items()
    term_frequency_tuples.sort(key=lambda item: item[1], reverse=True)
    return dict(term_frequency_tuples[0:num_terms])

def get_standard_query_params(request):
    params = ['server', 'apiToken', 'documentSetId', 'vizId']
    return {key:request.args.get(key) for key in params}

@app.route("/metadata", methods=['GET'])
def metadata():
    return make_response("", 204, {'Access-Control-Allow-Origin': '*'})

@app.route("/show", methods=['GET'])
def show():
    params = get_standard_query_params(request)
    client = OverviewAPI(requests, server, api_token)
    return jsonify()

@app.route("/generate", methods=["GET"])
def generate():
    params = get_standard_query_params(request)
    client = OverviewAPI(requests, params["server"], params["apiToken"])
    docs   = client.get_documents(params["documentSetId"])
    term_frequency_map = Counter()
    term_df = Counter()

    for doc_id in docs:
        doc_tokens = set()
        for token in get_tokens(docs[doc_id]):
            term_frequency_map[token] += 1
            if token not in doc_tokens
                doc_tokens.add(token)
                term_df[token] += 1

    # keep only the top terms
    term_frequency_map = get_top_terms(term_frequency_map, 500)
    jsonResponse = jsonify(term_frequency_map)

    # try to save the data, returning it to the client on success.
    if client.save_viz_data(params["vizId"], "Word Cloud", term_frequency_map):
        return jsonResponse
    else:
        make_response("Error saving data", 500)

if __name__ == "__main__":
        runner.run()