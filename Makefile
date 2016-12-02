.PHONY: build clean lint collect website

build:
	docker-compose build

clean:
	docker-compose run --rm --entrypoint bash \
		collect -c 'rm data/*.json'

lint:
	docker-compose run --rm --entrypoint flake8 collect .

console:
	docker-compose run --rm --entrypoint /bin/bash collect

collect:
	docker-compose run --rm collect
