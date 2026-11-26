// Build the OAN Messaging console image and publish it to AWS ECR:
//   379220350808.dkr.ecr.ap-south-1.amazonaws.com/eoan/<repo name>/<service>:<version>
// <version> = init.yaml's version plus -<branch>.<build> (for example 1.0.0-develop.7), the same style as the
// other eoan/ images; a second tag carries the 12-character commit. Tags in the repository are immutable.
// After the push, the pin stage commits the new image tag to oan-helm's values (develop only; automated pin only).
// Jenkins job: oan-messaging-ui (ci/jenkins/jobs/oan-messaging-ui.xml), builds the develop branch; develop publishes.
// Needs the Jenkins credential aws-ecr-creds-new (AWS Credentials with ECR push access).
pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }

    environment {
        AWS_REGION     = 'ap-south-1'
        IMAGE_REGISTRY = '379220350808.dkr.ecr.ap-south-1.amazonaws.com'
        SERVICE        = 'oan-messaging-ui'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    // The version is init.yaml's; the tag and the ECR repository come from image_names.py
                    // (oan-helm docs/release/naming-standard.md, section 6).
                    def sha  = sh(returnStdout: true, script: 'git rev-parse --short=12 HEAD').trim()
                    env.IMAGE_VERSION = sh(returnStdout: true,
                        script: 'python3 scripts/ci/image_names.py tag "$BRANCH_NAME" "$BUILD_NUMBER"').trim()
                    env.ECR_REPO      = sh(returnStdout: true, script: 'python3 scripts/ci/image_names.py repository').trim()
                    env.IMAGE         = "${env.IMAGE_REGISTRY}/${env.ECR_REPO}"
                    env.IMAGE_SHA     = sha
                    echo "Image ${env.IMAGE}:${env.IMAGE_VERSION} (commit ${sha})"
                }
            }
        }

        stage('Validate') {
            // Isolated, Docker-only: locked install, lint, typecheck, tests and the production build
            // (ci/README.md). JUnit results are published whatever the outcome.
            steps {
                sh 'python3 scripts/ci/tests/test_image_names.py'
                sh 'python3 scripts/ci/tests/test_pin_image_in_oan_helm.py'
                sh 'bash ci/run-isolated.sh'
            }
            post { always { junit allowEmptyResults: false, testResults: 'reports/tests.xml' } }
        }

        stage('Build image') {
            steps {
                sh '''
                    docker build -t "$IMAGE:$IMAGE_VERSION" -t "$IMAGE:$IMAGE_SHA" .
                '''
            }
        }

        stage('Push image') {
            when { branch 'develop' }
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-ecr-creds-new']]) {
                    sh '''
                        aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPO" >/dev/null 2>&1 || \
                            aws ecr create-repository --region "$AWS_REGION" --repository-name "$ECR_REPO" \
                                --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
                        aws ecr get-login-password --region "$AWS_REGION" \
                            | docker login --username AWS --password-stdin "$IMAGE_REGISTRY"
                        docker push "$IMAGE:$IMAGE_VERSION"
                        docker push "$IMAGE:$IMAGE_SHA"
                    '''
                }
            }
        }

        // The image tag is pinned in oan-helm's values by one API commit with oan-helm-fork-token, like the other
        // automation accounts of oan-helm; the commit starts the New Dev delivery (oan-helm-dev-commons,
        // scripts/ci/deliver_dev_oan_messaging.sh).
        stage('Pin image in oan-helm') {
            when { branch 'develop' }
            steps {
                withCredentials([usernamePassword(credentialsId: 'oan-helm-fork-token', usernameVariable: 'GH_USER', passwordVariable: 'GH_TOKEN')]) {
                    sh '''
                        digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$IMAGE:$IMAGE_VERSION" | sed 's/.*@//')
                        python3 scripts/ci/pin_image_in_oan_helm.py ui "$IMAGE_VERSION" "$digest"
                    '''
                }
            }
        }
    }

    post {
        success { echo "Published ${env.IMAGE}:${env.IMAGE_VERSION}" }
        always  { sh 'docker rmi "$IMAGE:$IMAGE_VERSION" "$IMAGE:$IMAGE_SHA" >/dev/null 2>&1 || true' }
    }
}
